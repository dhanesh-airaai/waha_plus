import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getProxyConfig } from '@waha/core/helpers.proxy';
import { MediaManager } from '@waha/core/media/MediaManager';
import { MediaStorageFactory } from '@waha/core/media/MediaStorageFactory';
import { LocalSessionMeRepository } from '@waha/core/storage/LocalSessionMeRepository';
import { MongoSessionMeRepository } from '@waha/plus/storage/MongoSessionMeRepository';
import { WAHAWebhookSessionStatus } from '@waha/structures/webhooks.dto';
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
  ProxyConfig,
  SessionConfig,
  SessionDetailedInfo,
  SessionDTO,
  SessionInfo,
} from '../structures/sessions.dto';
import { WebhookConfig } from '../structures/webhooks.config.dto';
import { WebJSEngineConfigService } from './config/WebJSEngineConfigService';
import { WhatsappSessionNoWebPlus } from './engines/noweb/session.noweb.plus';
import { WhatsappSessionWebJSPlus } from './engines/webjs/session.webjs.plus';
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
    private mediaStorageFactory: MediaStorageFactory,
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
      this.sessionMeRepository = new MongoSessionMeRepository(this.store);
    } else {
      this.log.info('Using local storage for session info.');
      this.store = new LocalStorePlus(engineName);
      await this.store.init();
      this.sessionAuthRepository = new LocalSessionAuthRepository(this.store);
      this.sessionConfigRepository = new LocalSessionConfigRepository(
        this.store,
      );
      this.sessionMeRepository = new LocalSessionMeRepository(this.store);
    }

    await this.sessionMeRepository.init();
    this.listenEvents();
    await this.clearStorage();
    this.restartStoppedSessions();
    this.startPredefinedSessions();
  }

  private listenEvents() {
    this.events.on(
      WAHAEvents.SESSION_STATUS,
      async (data: WAHAWebhookSessionStatus) => {
        if (data.me) {
          await this.sessionMeRepository.upsertMe(data.session, data.me);
        }
      },
    );
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
    await this.store?.close();
    await super.beforeApplicationShutdown(signal);
  }

  private async clearStorage() {
    const storage = this.mediaStorageFactory.build(
      this.log.logger.child({ name: 'Storage' }),
    );
    await storage.purge();
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
    await this.sessionAuthRepository.clean(name);
    await this.sessionMeRepository.removeMe(name);
    this.log.info(`Session deleted.`, { session: name });
  }

  async start(name: string): Promise<SessionDTO> {
    this.log.info(`starting session...`, { session: name });
    if (this.isRunning(name)) {
      const msg = `Session '${name}' is already started.`;
      throw new UnprocessableEntityException(msg);
    }

    const logger = this.log.logger.child({ session: name });
    const config = await this.sessionConfigRepository.get(name);
    await this.sessionAuthRepository.init(name);
    logger.level = getPinoLogLevel(config?.debug);
    const loggerBuilder: LoggerBuilder = logger;

    const storage = this.mediaStorageFactory.build(
      loggerBuilder.child({ name: 'Storage' }),
    );
    await storage.init();
    const mediaManager = new MediaManager(
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
    await this.sessionMeRepository.removeMe(name);
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
        `We didn't find a session with name '${name}'.\n` +
          `Please start it first by using POST /api/sessions/${name}/start request`,
      );
    }
    return session;
  }

  /**
   * Get all runtime sessions
   */
  private getRuntimeSessions(name: string = null): SessionInfo[] {
    let names = Object.keys(this.sessions);
    if (name) {
      names = names.filter((n) => n === name);
    }
    const sessions = names.map((sessionName) => {
      const status = this.sessions[sessionName].status;
      const sessionConfig = this.sessions[sessionName].sessionConfig;
      const me = this.sessions[sessionName].getSessionMeInfo();
      return {
        name: sessionName,
        status: status,
        config: sessionConfig,
        me: me,
      };
    });
    return sessions;
  }

  /**
   * Get all sessions
   * Even tho it's "offline", it usually contains both offline and online sessions
   **/
  private async getOfflineSessions(
    name: string = null,
  ): Promise<SessionInfo[]> {
    let names = await this.sessionConfigRepository.getAll();
    if (name) {
      names = names.filter((n) => n === name);
    }
    const sessions = names.map(async (sessionName) => {
      const status = WAHASessionStatus.STOPPED;
      const sessionConfig = await this.sessionConfigRepository.get(sessionName);
      const me = await this.sessionMeRepository.getMe(sessionName);
      return {
        name: sessionName,
        status: status,
        config: sessionConfig,
        me: me,
      };
    });
    return await Promise.all(sessions);
  }

  async getSessions(all: boolean): Promise<SessionInfo[]> {
    const runtimeSessions = this.getRuntimeSessions();
    let offlineSessions: SessionInfo[] = [];
    if (all) {
      offlineSessions = await this.getOfflineSessions();
    }
    // Merge runtime and offline by name
    // Runtime one will overwrite offline one
    const sessions = lodash.keyBy(
      [...offlineSessions, ...runtimeSessions],
      'name',
    );
    return Object.values(sessions);
  }

  async getSessionInfo(name: string): Promise<SessionDetailedInfo | null> {
    let session: SessionDetailedInfo = null;

    // Try to find session in runtime sessions
    const runtimeSessions = this.getRuntimeSessions(name);
    if (runtimeSessions.length === 1) {
      session = runtimeSessions[0];
    }

    // If session is not found in runtime sessions,
    // try to find it in offline sessions
    if (!session) {
      const offlineSessions = await this.getOfflineSessions(name);
      if (offlineSessions.length === 1) {
        session = offlineSessions[0];
      }
    }

    // No session found
    if (!session) {
      return null;
    }

    // If session is found, get engine info
    const engine = await this.fetchEngineInfo(name);
    return {
      ...session,
      engine: engine,
    };
  }

  private async fetchEngineInfo(sessionName: string) {
    // Get engine info
    if (!this.sessions[sessionName]) {
      return {};
    }
    const session = this.sessions[sessionName];
    let engineInfo = {};
    try {
      engineInfo = await promiseTimeout(1000, session.getEngineInfo());
    } catch (error) {
      this.log.warn(
        { session: session.name, error: `${error}` },
        'Error while getting engine info',
      );
    }

    return {
      engine: this.sessions[sessionName]?.engine,
      ...engineInfo,
    };
  }
}
