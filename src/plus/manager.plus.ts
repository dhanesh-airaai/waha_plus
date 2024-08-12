import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getProxyConfig } from '@waha/core/helpers.proxy';
import { getPinoLogLevel, LoggerBuilder } from '@waha/utils/logging';
import { promiseTimeout, sleep } from '@waha/utils/promiseTimeout';
import { EventEmitter } from 'events';
import * as lodash from 'lodash';
import { MongoClient } from 'mongodb';
import { PinoLogger } from 'nestjs-pino';

import { WhatsappConfigService } from '../config.service';
import { SessionManager } from '../core/abc/manager.abc';
import { SessionParams, WhatsappSession } from '../core/abc/session.abc';
import { EngineConfigService } from '../core/config/EngineConfigService';
import { LocalSessionAuthRepository } from '../core/storage/LocalSessionAuthRepository';
import { LocalSessionConfigRepository } from '../core/storage/LocalSessionConfigRepository';
import {
  WAHAEngine,
  WAHAEvents,
  WAHASessionStatus,
} from '../structures/enums.dto';
import {
  MeInfo,
  ProxyConfig,
  SessionConfig,
  SessionDTO,
  SessionInfo,
} from '../structures/sessions.dto';
import { WebhookConfig } from '../structures/webhooks.config.dto';
import { WebJSEngineConfigService } from './config/WebJSEngineConfigService';
import { WhatsappSessionNoWebPlus } from './engines/noweb/session.noweb.plus';
import { WhatsappSessionVenomPlus } from './engines/venom/session.venom.plus';
import { WhatsappSessionWebJSPlus } from './engines/webjs/session.webjs.plus';
import { MediaStoragePlus, PlusMediaManager } from './media.plus';
import { LocalStorePlus } from './storage/LocalStorePlus';
import { MongoSessionAuthRepository } from './storage/MongoSessionAuthRepository';
import { MongoSessionConfigRepository } from './storage/MongoSessionConfigRepository';
import { MongoStore } from './storage/MongoStore';
import { WebhookConductorPlus } from './webhooks.plus';

@Injectable()
export class SessionManagerPlus extends SessionManager {
  SESSION_STOP_TIMEOUT = 3000;
  private readonly sessions: Record<string, WhatsappSession>;

  // @ts-ignore
  protected WebhookConductorClass = WebhookConductorPlus;
  protected readonly EngineClass: typeof WhatsappSession;

  constructor(
    private config: WhatsappConfigService,
    private engineConfigService: EngineConfigService,
    private webjsEngineConfigService: WebJSEngineConfigService,
    private log: PinoLogger,
  ) {
    super();
    this.log.setContext(SessionManagerPlus.name);
    this.sessions = {};
    const engineName = this.engineConfigService.getDefaultEngineName();
    this.EngineClass = this.getEngine(engineName);
    this.events = new EventEmitter();
  }

  async init() {
    const engineName = this.engineConfigService
      .getDefaultEngineName()
      .toLowerCase();
    const mongoUrl = this.config.getSessionMongoUrl();
    if (mongoUrl) {
      this.log.info('Using mongo storage for session info.');
      const mongo = new MongoClient(mongoUrl);
      this.log.info(`Connecting to mongo '${mongoUrl}'...`);
      await mongo.connect();
      this.log.info(`Connected to mongo '${mongoUrl}'!`);

      this.store = new MongoStore(mongo, engineName);
      await this.store.init();
      this.sessionAuthRepository = new MongoSessionAuthRepository(this.store);
      this.sessionConfigRepository = new MongoSessionConfigRepository(
        this.store,
      );
    } else {
      this.log.info('Using local storage for session info.');
      this.store = new LocalStorePlus(engineName);
      await this.store.init();
      this.sessionAuthRepository = new LocalSessionAuthRepository(this.store);
      this.sessionConfigRepository = new LocalSessionConfigRepository(
        this.store,
      );
    }

    this.clearStorage();
    this.restartStoppedSessions();
    this.startPredefinedSessions();
  }

  protected async restartStoppedSessions() {
    if (!this.config.shouldRestartAllSessions) {
      return;
    }

    const stoppedSessions = await this.sessionConfigRepository.getAll();

    const promises = stoppedSessions.map(async (sessionName) => {
      this.log.info(`Restarting STOPPED session - ${sessionName}...`);
      return this.start(sessionName);
    });
    await Promise.all(promises);
  }

  protected async startPredefinedSessions() {
    const startSessions = this.config.startSessions;
    const promises = startSessions.map(async (sessionName) => {
      // Do not start already started session
      if (this.sessions[sessionName]) {
        return;
      }
      return this.start(sessionName);
    });
    await Promise.all(promises);
  }

  protected getEngine(engine: WAHAEngine): typeof WhatsappSession {
    if (engine === WAHAEngine.WEBJS) {
      return WhatsappSessionWebJSPlus;
    } else if (engine === WAHAEngine.VENOM) {
      return WhatsappSessionVenomPlus;
    } else if (engine === WAHAEngine.NOWEB) {
      return WhatsappSessionNoWebPlus;
    } else {
      throw new NotFoundException(`Unknown whatsapp engine '${engine}'.`);
    }
  }

  async beforeApplicationShutdown(signal?: string) {
    this.log.info('Stop all sessions...');
    const promises = Object.keys(this.sessions).map(async (sessionName) => {
      await this.stop(sessionName, true);
    });
    this.log.info('All sessions have been stopped.');
    await Promise.all(promises);
  }

  private clearStorage() {
    /* We need to clear the local storage just once */
    const storage = new MediaStoragePlus(
      this.log.logger.child({ name: 'Storage' }),
      this.config.filesFolder,
      this.config.filesURL,
      this.config.filesLifetime,
    );
    storage.purge();
  }

  //
  // API Methods
  //
  async exists(name: string): Promise<boolean> {
    return await this.sessionConfigRepository.exists(name);
  }

  isRunning(name: string): boolean {
    return !!this.sessions[name];
  }

  async upsert(name: string, config?: SessionConfig): Promise<void> {
    this.log.info(`Saving session...`, { session: name });
    await this.sessionAuthRepository.init(name);
    await this.sessionConfigRepository.save(name, config || null);
    this.log.info(`Session saved.`, { session: name });
  }

  async delete(name: string): Promise<void> {
    this.log.info(`Deleting session...`, { session: name });
    await this.sessionConfigRepository.delete(name);
    this.log.info(`Session deleted.`, { session: name });
  }

  async start(name: string): Promise<SessionDTO> {
    this.log.info(`starting session...`, { session: name });
    if (this.isRunning(name)) {
      const msg = `Session '${name}' is already started.`;
      throw new UnprocessableEntityException(msg);
    }

    const logger = this.log.logger.child({
      session: name,
      sessionRunTimestamp: Date.now(),
    });
    const config = await this.sessionConfigRepository.get(name);
    await this.sessionAuthRepository.init(name);
    logger.level = getPinoLogLevel(config?.debug);
    const loggerBuilder: LoggerBuilder = logger;

    const storage = new MediaStoragePlus(
      loggerBuilder.child({ name: 'Storage' }),
      this.config.filesFolder,
      this.config.filesURL,
      this.config.filesLifetime,
    );
    const mediaManager = new PlusMediaManager(
      storage,
      this.config.mimetypes,
      loggerBuilder.child({ name: 'MediaManager' }),
    );
    const webhook = new this.WebhookConductorClass(loggerBuilder);
    const proxyConfig = this.getProxyConfig(name, config);
    const sessionConfig: SessionParams = {
      name,
      mediaManager,
      loggerBuilder,
      printQR: this.engineConfigService.shouldPrintQR,
      sessionStore: this.store,
      proxyConfig: proxyConfig,
      sessionConfig: config,
    };
    if (this.EngineClass === WhatsappSessionWebJSPlus) {
      sessionConfig.engineConfig = this.webjsEngineConfigService.getConfig();
    }
    // @ts-ignore
    const session = new this.EngineClass(sessionConfig);
    this.sessions[name] = session;

    // configure webhooks
    const webhooks = this.getWebhooks(config);
    webhook.configure(session, webhooks);

    // configure events
    session.events.on(
      WAHAEvents.SESSION_STATUS,
      this.handleSessionEvent(WAHAEvents.SESSION_STATUS, session),
    );

    // start session
    await session.start();
    logger.info('Session has been started.');
    return {
      name: session.name,
      status: session.status,
      config: session.sessionConfig,
    };
  }

  /**
   * Stop session
   * @param name
   * @param silent - if true, throw error if session is not stopped successfully
   */
  async stop(name: string, silent: boolean): Promise<void> {
    if (!this.isRunning(name)) {
      this.log.debug(`Session is not running.`, { session: name });
      return;
    }

    this.log.info(`Stopping session...`, { session: name });
    try {
      const session = this.getSession(name);
      await session.stop();
    } catch (err) {
      this.log.warn(`Error while stopping session '${name}'`);
      if (!silent) {
        throw err;
      }
    }
    this.log.info(`Session has been stopped.`, { session: name });
    delete this.sessions[name];
    await sleep(this.SESSION_STOP_TIMEOUT);
  }

  async logout(name: string): Promise<void> {
    this.log.info(`Logging out session...`, { session: name });
    await this.sessionAuthRepository.clean(name);
    this.log.info(`Session has been logged out.`, { session: name });
  }

  /**
   * Combine per session and global webhooks
   */
  private getWebhooks(config: SessionConfig) {
    let webhooks: WebhookConfig[] = [];
    if (config?.webhooks) {
      webhooks = webhooks.concat(config.webhooks);
    }
    const globalWebhookConfig = this.config.getWebhookConfig();
    if (globalWebhookConfig) {
      webhooks.push(globalWebhookConfig);
    }
    return webhooks;
  }

  /**
   * Get either session's or global proxy if defined
   */
  protected getProxyConfig(
    name: string,
    config?: SessionConfig,
  ): ProxyConfig | undefined {
    if (config?.proxy) {
      return config.proxy;
    }
    return getProxyConfig(this.config, this.sessions, name);
  }

  getSession(name: string): WhatsappSession {
    const session = this.sessions[name];
    if (!session) {
      throw new NotFoundException(
        `We didn't find a session with name '${name}'. Please start it first by using POST /sessions/start request`,
      );
    }
    return session;
  }

  async getSessions(all, name?: string): Promise<SessionInfo[]> {
    let sessionNames = Object.keys(this.sessions);
    if (all) {
      const stoppedSession = await this.sessionConfigRepository.getAll();
      sessionNames = lodash.union(sessionNames, stoppedSession);
    }

    if (name) {
      sessionNames = sessionNames.filter((sessionName) => sessionName === name);
    }

    const sessions = sessionNames.map(async (sessionName) => {
      const status =
        this.sessions[sessionName]?.status || WAHASessionStatus.STOPPED;
      let sessionConfig: SessionConfig | undefined;
      let me: MeInfo | null;

      // Get engine info
      let engineInfo = {};
      if (this.sessions[sessionName]) {
        try {
          engineInfo = await promiseTimeout(
            10,
            this.sessions[sessionName].getEngineInfo(),
          );
        } catch (error) {
          this.log.warn(
            { session: sessionName, error: error },
            'Error while getting engine info',
          );
        }
      }

      const engine = {
        engine: this.sessions[sessionName]?.engine,
        ...engineInfo,
      };
      if (status != WAHASessionStatus.STOPPED) {
        sessionConfig = this.sessions[sessionName].sessionConfig;
        me = this.sessions[sessionName].getSessionMeInfo();
      } else {
        sessionConfig = await this.sessionConfigRepository.get(sessionName);
        me = null;
      }
      return {
        name: sessionName,
        status: status,
        config: sessionConfig,
        me: me,
        engine: engine,
      };
    });
    return await Promise.all(sessions);
  }

  async getSessionInfo(name: string): Promise<SessionInfo | null> {
    const sessions = await this.getSessions(true, name);
    if (sessions.length === 0) {
      return null;
    }
    return sessions[0];
  }
}
