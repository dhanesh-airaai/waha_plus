import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getProxyConfig } from '@waha/core/helpers.proxy';
import { getPinoLogLevel, LoggerBuilder } from '@waha/utils/logging';
import { promiseTimeout } from '@waha/utils/promiseTimeout';
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
  SessionInfo,
  SessionLogoutRequest,
  SessionStartRequest,
  SessionStopRequest,
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
      const config = await this.sessionConfigRepository.get(sessionName);
      return this.startOld({ name: sessionName, config: config });
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
      const config = await this.sessionConfigRepository.get(sessionName);
      return this.startOld({ name: sessionName, config: config });
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
    for (const name of Object.keys(this.sessions)) {
      try {
        await this.stopOld({ name: name, logout: false });
      } catch (err) {
        this.log.error(`Error while stopping session '${name}'`, err);
      }
    }
    this.log.info('All sessions have been stopped.');
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
  async startOld(request: SessionStartRequest) {
    const name = request.name;
    if (this.sessions[name]) {
      throw new UnprocessableEntityException(
        `Session '${name}' is already started.`,
      );
    }
    this.log.info(`starting session...`, { session: name });
    const logger = this.log.logger.child({ session: name });
    logger.level = getPinoLogLevel(request.config?.debug);
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
    const proxyConfig = this.getProxyConfig(request);
    const sessionConfig: SessionParams = {
      name,
      mediaManager,
      loggerBuilder,
      printQR: this.engineConfigService.shouldPrintQR,
      sessionStore: this.store,
      proxyConfig: proxyConfig,
      sessionConfig: request.config,
    };
    if (this.EngineClass === WhatsappSessionWebJSPlus) {
      sessionConfig.engineConfig = this.webjsEngineConfigService.getConfig();
    }
    await this.sessionAuthRepository.init(name);
    // @ts-ignore
    const session = new this.EngineClass(sessionConfig);
    this.sessions[name] = session;

    // configure webhooks
    const webhooks = this.getWebhooks(request);
    webhook.configure(session, webhooks);

    // configure events
    session.events.on(
      WAHAEvents.SESSION_STATUS,
      this.handleSessionEvent(WAHAEvents.SESSION_STATUS, session),
    );

    // start session
    await session.start();
    return {
      name: session.name,
      status: session.status,
      config: session.sessionConfig,
    };
  }

  /**
   * Combine per session and global webhooks
   */
  private getWebhooks(request: SessionStartRequest) {
    let webhooks: WebhookConfig[] = [];
    if (request.config?.webhooks) {
      webhooks = webhooks.concat(request.config.webhooks);
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
    request: SessionStartRequest,
  ): ProxyConfig | undefined {
    if (request.config?.proxy) {
      return request.config.proxy;
    }
    return getProxyConfig(this.config, this.sessions, request.name);
  }

  async stopOld(request: SessionStopRequest) {
    const name = request.name;
    this.log.info(`Stopping ${name} session...`);
    const session = this.getSession(name);
    await session.stop();
    this.log.info(`"${name}" has been stopped.`);
    delete this.sessions[name];
  }

  async logoutOld(request: SessionLogoutRequest) {
    const name = request.name;
    this.stopOld({ name: name, logout: false })
      .then(() => {
        this.log.info(`Session '${name}' has been stopped.`);
      })
      .catch((err) => {
        this.log.error(
          `Error while stopping session '${name}' while logging out`,
          err,
        );
      });
    await this.sessionAuthRepository.clean(request.name);
    await this.sessionConfigRepository.delete(request.name);
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
        } catch (e) {
          this.log.warn(
            { session: sessionName },
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
