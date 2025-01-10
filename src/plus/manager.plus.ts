import {
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import {
  EngineBootstrap,
  NoopEngineBootstrap,
} from '@waha/core/abc/EngineBootstrap';
import { GowsEngineConfigService } from '@waha/core/config/GowsEngineConfigService';
import { WebJSEngineConfigService } from '@waha/core/config/WebJSEngineConfigService';
import { getProxyConfig } from '@waha/core/helpers.proxy';
import { WebhookConductor } from '@waha/core/integrations/webhooks/WebhookConductor';
import { MediaManager } from '@waha/core/media/MediaManager';
import { MediaStorageFactory } from '@waha/core/media/MediaStorageFactory';
import { LocalSessionMeRepository } from '@waha/core/storage/LocalSessionMeRepository';
import { LocalSessionWorkerRepository } from '@waha/core/storage/LocalSessionWorkerRepository';
import { WhatsappSessionGoWSPlus } from '@waha/plus/engines/gows/session.gows.plus';
import { MongoSessionMeRepository } from '@waha/plus/storage/MongoSessionMeRepository';
import { MongoSessionWorkerRepository } from '@waha/plus/storage/MongoSessionWorkerRepository';
import { WAHAWebhookSessionStatus } from '@waha/structures/webhooks.dto';
import { DefaultMap } from '@waha/utils/DefaultMap';
import { getPinoLogLevel, LoggerBuilder } from '@waha/utils/logging';
import { promiseTimeout, sleep } from '@waha/utils/promiseTimeout';
import { complete } from '@waha/utils/reactive/complete';
import { SwitchObservable } from '@waha/utils/reactive/SwitchObservable';
import * as lodash from 'lodash';
import { MongoClient } from 'mongodb';
import { PinoLogger } from 'nestjs-pino';
import { merge, Observable, retry, share } from 'rxjs';
import { map } from 'rxjs/operators';

import { WhatsappConfigService } from '../config.service';
import { populateSessionInfo, SessionManager } from '../core/abc/manager.abc';
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
import { WhatsappSessionNoWebPlus } from './engines/noweb/session.noweb.plus';
import { WhatsappSessionWebJSPlus } from './engines/webjs/session.webjs.plus';
import { LocalStorePlus } from './storage/LocalStorePlus';
import { MongoSessionAuthRepository } from './storage/MongoSessionAuthRepository';
import { MongoSessionConfigRepository } from './storage/MongoSessionConfigRepository';
import { MongoStore } from './storage/MongoStore';

const ALL = '*';

@Injectable()
export class SessionManagerPlus
  extends SessionManager
  implements OnModuleInit, OnApplicationBootstrap
{
  SESSION_STOP_TIMEOUT = 3000;
  SESSION_UNPAIR_TIMEOUT = 1000;
  private readonly sessions: Record<string, WhatsappSession>;

  protected readonly EngineClass: typeof WhatsappSession;
  protected readonly engineBootstrap: EngineBootstrap;

  protected events2: DefaultMap<
    string,
    DefaultMap<WAHAEvents, SwitchObservable<any>>
  >;

  constructor(
    config: WhatsappConfigService,
    private engineConfigService: EngineConfigService,
    private webjsEngineConfigService: WebJSEngineConfigService,
    gowsConfigService: GowsEngineConfigService,
    log: PinoLogger,
    private mediaStorageFactory: MediaStorageFactory,
  ) {
    super(log, config, gowsConfigService);
    this.sessions = {};
    const engineName = this.engineConfigService.getDefaultEngineName();
    this.EngineClass = this.getEngine(engineName);
    this.engineBootstrap = this.getEngineBootstrap(engineName);

    this.events2 = new DefaultMap(
      (session: string) =>
        new DefaultMap<WAHAEvents, SwitchObservable<any>>(
          (key) =>
            new SwitchObservable((obs$) => {
              return obs$.pipe(retry(), share());
            }),
        ),
    );
  }

  async onModuleInit() {
    await this.init();
  }

  async onApplicationBootstrap() {
    await this.engineBootstrap.bootstrap();
    await this.restartSessions();
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
      this.sessionWorkerRepository = new MongoSessionWorkerRepository(
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
      this.sessionMeRepository = new LocalSessionMeRepository(this.store);
      this.sessionWorkerRepository = new LocalSessionWorkerRepository(
        this.store,
      );
    }

    await this.sessionMeRepository.init();
    await this.sessionWorkerRepository.init();
    this.listenEvents();
    await this.clearStorage();
  }

  async restartSessions() {
    let restartSessions: string[];
    if (this.config.shouldRestartAllSessions) {
      this.log.info(`Restarting ALL STOPPED sessions...`);
      restartSessions = await this.sessionConfigRepository.getAll();
    } else if (this.config.shouldRestartWorkerSessions) {
      this.log.info(`Starting sessions for the worker "${this.workerId}"...`);
      restartSessions = await this.sessionWorkerRepository.getSessionsByWorker(
        this.workerId,
      );
    }

    if (restartSessions != null) {
      this.restartStoppedSessions(restartSessions).catch((error) => {
        this.log.error(`Error while restarting STOPPED sessions: ${error}`);
        this.log.error(error.stack);
      });
    } else {
      this.log.info(`No sessions to restart.`);
    }

    this.startPredefinedSessions();
  }

  private listenEvents() {
    this.events2
      .get(ALL)
      .get(WAHAEvents.SESSION_STATUS)
      .subscribe(async (data: WAHAWebhookSessionStatus) => {
        if (data.me) {
          await this.sessionMeRepository.upsertMe(data.session, data.me);
        }
      });
  }

  protected async restartStoppedSessions(sessions: string[]) {
    // Wait until HTTP/WS server is ready
    await sleep(1000);

    const sleepS = this.config.autoStartDelaySeconds;
    this.log.info(`Restarting sessions with delay of ${sleepS} seconds...`);
    const sleepMs = this.config.autoStartDelaySeconds * 1000;
    for (const sessionName of sessions) {
      await this.withLock(sessionName, async () => {
        const log = this.log.logger.child({ session: sessionName });
        log.info(`Restarting STOPPED session...`);
        await this.start(sessionName).catch((error) => {
          log.error(`Failed to start STOPPED session: ${error}`);
          log.error(error.stack);
        });
      });
      await sleep(sleepMs);
    }
    this.log.info(`STOPPED sessions have been restarted.`);
  }

  protected getEngine(engine: WAHAEngine): typeof WhatsappSession {
    if (engine === WAHAEngine.WEBJS) {
      return WhatsappSessionWebJSPlus;
    } else if (engine === WAHAEngine.NOWEB) {
      return WhatsappSessionNoWebPlus;
    } else if (engine === WAHAEngine.GOWS) {
      return WhatsappSessionGoWSPlus;
    } else {
      throw new Error(`Unknown whatsapp engine '${engine}'.`);
    }
  }

  async beforeApplicationShutdown(signal?: string) {
    this.log.info('Stop all sessions...');
    const promises = Object.keys(this.sessions).map(async (sessionName) => {
      await this.stop(sessionName, true);
    });
    await Promise.all(promises);
    this.log.info('All sessions have been stopped.');
    this.stopEvents();
    await this.store?.close();
    await this.engineBootstrap.shutdown();
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
    this.log.info({ session: name }, `Saving session...`);
    await this.sessionAuthRepository.init(name);
    await this.sessionConfigRepository.save(name, config || null);
    this.log.info({ session: name }, `Session saved.`);
  }

  async delete(name: string): Promise<void> {
    this.log.info({ session: name }, `Deleting session...`);
    await this.sessionConfigRepository.delete(name);
    await this.sessionAuthRepository.clean(name);
    await this.sessionMeRepository.removeMe(name);
    await this.sessionWorkerRepository.remove(name);
    this.log.info({ session: name }, `Session deleted.`);
  }

  async start(name: string): Promise<SessionDTO> {
    this.log.info({ session: name }, `Starting session...`);
    if (this.isRunning(name)) {
      this.log.info({ session: name }, `Session is already running.`);
      return;
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
    const webhook = new WebhookConductor(loggerBuilder);
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
    } else if (this.EngineClass === WhatsappSessionGoWSPlus) {
      sessionConfig.engineConfig = this.gowsConfigService.getConfig();
    }
    // @ts-ignore
    const session = new this.EngineClass(sessionConfig);
    this.sessions[name] = session;
    this.updateSessions();

    // configure webhooks
    const webhooks = this.getWebhooks(config);
    webhook.configure(session, webhooks);

    // start session
    await session.start();
    logger.info('Session has been started.');
    return {
      name: session.name,
      status: session.status,
      config: session.sessionConfig,
    };
  }

  private updateSessions() {
    const sessions = Object.values(this.sessions);
    for (const eventName in WAHAEvents) {
      const event = WAHAEvents[eventName];
      const streams = [];
      for (const session of sessions) {
        const stream$ = session
          .getEventObservable(event)
          .pipe(map(populateSessionInfo(event, session)), share());
        this.events2.get(session.name).get(event).switch(stream$);
        streams.push(stream$);
      }
      this.events2
        .get(ALL)
        .get(event)
        .switch(merge(...streams));
    }
  }

  getSessionEvent(session: string, event: WAHAEvents): Observable<any> {
    return this.events2.get(session).get(event);
  }

  /**
   * Stop session
   * @param name
   * @param silent - if true, throw error if session is not stopped successfully
   */
  async stop(name: string, silent: boolean): Promise<void> {
    if (!this.isRunning(name)) {
      this.log.debug({ session: name }, `Session is not running.`);
      return;
    }

    this.log.info({ session: name }, `Stopping session...`);
    try {
      const session = this.getSession(name);
      await session.stop();
    } catch (err) {
      this.log.warn({ session: name }, `Error while stopping session`);
      if (!silent) {
        throw err;
      }
    }
    this.log.info({ session: name }, `Session has been stopped.`);
    delete this.sessions[name];
    this.updateSessions();
    await sleep(this.SESSION_STOP_TIMEOUT);
  }

  async unpair(name: string) {
    const session = this.sessions[name];
    if (!session) {
      return;
    }
    this.log.info({ session: name }, 'Unpairing the device from account...');
    await session.unpair().catch((err) => {
      this.log.warn(`Error while unpairing from device: ${err}`);
    });
    await sleep(this.SESSION_UNPAIR_TIMEOUT);
  }

  async logout(name: string): Promise<void> {
    this.log.info({ session: name }, `Logging out session...`);
    await this.sessionAuthRepository.clean(name);
    await this.sessionMeRepository.removeMe(name);
    this.log.info({ session: name }, `Session has been logged out.`);
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

    // Get assigned worker
    const workersInfo = await this.sessionWorkerRepository.getAll();
    const workerBySession = lodash.keyBy(workersInfo, 'id');
    Object.keys(sessions).forEach((sessionName) => {
      sessions[sessionName].assignedWorker =
        workerBySession[sessionName]?.worker;
    });

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
      engineInfo = await promiseTimeout(3_000, session.getEngineInfo());
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

  protected stopEvents() {
    for (const events of this.events2.values()) {
      complete(events);
    }
  }
}
