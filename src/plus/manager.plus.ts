import { ConsoleLogger, Injectable, NotFoundException } from '@nestjs/common';
import * as lodash from 'lodash';
import { MongoClient } from 'mongodb';
import { getProxyConfig } from 'src/core/helpers.proxy';

import { WhatsappConfigService } from '../config.service';
import { SessionManager } from '../core/abc/manager.abc';
import { SessionParams, WhatsappSession } from '../core/abc/session.abc';
import { buildLogger } from '../core/manager.core';
import { LocalSessionAuthRepository } from '../core/storage/LocalSessionAuthRepository';
import { LocalSessionConfigRepository } from '../core/storage/LocalSessionConfigRepository';
import { getLogLevels } from '../helpers';
import { WAHAEngine, WAHASessionStatus } from '../structures/enums.dto';
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
import { WhatsappSessionMobilePlus } from './engines/mobile/session.mobile.plus';
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
    private log: ConsoleLogger,
  ) {
    super();
    this.log.setContext('SessionManager');
    this.sessions = {};
    const engineName = this.config.getDefaultEngineName();
    this.EngineClass = this.getEngine(engineName);
  }

  async init() {
    const engineName = this.config.getDefaultEngineName().toLowerCase();
    const mongoUrl = this.config.getSessionMongoUrl();
    if (mongoUrl) {
      this.log.log('Using mongo storage for session info.');
      const mongo = new MongoClient(mongoUrl);
      this.log.log(`Connecting to mongo '${mongoUrl}'...`);
      await mongo.connect();
      this.log.log(`Connected to mongo '${mongoUrl}'!`);

      this.store = new MongoStore(mongo, engineName);
      this.sessionAuthRepository = new MongoSessionAuthRepository(this.store);
      this.sessionConfigRepository = new MongoSessionConfigRepository(
        this.store,
      );
    } else {
      this.log.log('Using local storage for session info.');
      this.store = new LocalStorePlus(engineName);
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

    const stoppedSessions = await this.sessionAuthRepository.getAll();

    const promises = stoppedSessions.map(async (sessionName) => {
      this.log.log(`Restarting STOPPED session - ${sessionName}...`);
      const config = await this.sessionConfigRepository.get(sessionName);
      return this.start({ name: sessionName, config: config });
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
      return this.start({ name: sessionName, config: config });
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
    } else if (engine === WAHAEngine.MOBILE) {
      return WhatsappSessionMobilePlus;
    } else {
      throw new NotFoundException(`Unknown whatsapp engine '${engine}'.`);
    }
  }

  async onApplicationShutdown(signal?: string) {
    this.log.log('Stop all sessions...');
    for (const name of Object.keys(this.sessions)) {
      await this.stop({ name: name, logout: false });
    }
  }

  private clearStorage() {
    const levels = getLogLevels(false);
    /* We need to clear the local storage just once */
    const storage = new MediaStoragePlus(
      buildLogger(`Storage`, levels),
      this.config.filesFolder,
      this.config.filesURL,
      this.config.filesLifetime,
    );
    storage.purge();
  }

  //
  // API Methods
  //
  async start(request: SessionStartRequest) {
    const name = request.name;
    this.log.log(`'${name}' - starting session...`);
    const levels = getLogLevels(request.config?.debug);
    const log = buildLogger(`WhatsappSession - ${name}`, levels);
    const storage = new MediaStoragePlus(
      buildLogger(`Storage - ${name}`, levels),
      this.config.filesFolder,
      this.config.filesURL,
      this.config.filesLifetime,
    );
    const mediaManager = new PlusMediaManager(
      storage,
      this.config.mimetypes,
      buildLogger(`MediaManager - ${name}`, levels),
    );
    const webhookLog = buildLogger(`Webhook - ${name}`, levels);
    const webhook = new this.WebhookConductorClass(webhookLog);
    const proxyConfig = this.getProxyConfig(request);
    const sessionConfig: SessionParams = {
      name,
      mediaManager,
      log,
      sessionStore: this.store,
      proxyConfig: proxyConfig,
      sessionConfig: request.config,
    };
    await this.sessionAuthRepository.init(name);
    // @ts-ignore
    const session = new this.EngineClass(sessionConfig);
    this.sessions[name] = session;

    // configure webhooks
    const webhooks = this.getWebhooks(request);
    webhook.configure(session, webhooks);

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

  async stop(request: SessionStopRequest) {
    const name = request.name;
    this.log.log(`Stopping ${name} session...`);
    const session = this.getSession(name);
    await session.stop();
    this.log.log(`"${name}" has been stopped.`);
    delete this.sessions[name];
  }

  async logout(request: SessionLogoutRequest) {
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

  async getSessions(all): Promise<SessionInfo[]> {
    let sessionNames = Object.keys(this.sessions);
    if (all) {
      const stoppedSession = await this.sessionAuthRepository.getAll();
      sessionNames = lodash.union(sessionNames, stoppedSession);
    }

    const sessions = sessionNames.map(async (sessionName) => {
      const status =
        this.sessions[sessionName]?.status || WAHASessionStatus.STOPPED;
      let sessionConfig: SessionConfig | undefined;
      let me: MeInfo | null;
      const engine = {
        engine: this.sessions[sessionName]?.engine,
        ...(await this.sessions[sessionName]
          ?.getEngineInfo()
          .catch((err) => ({}))),
      };
      if (status != WAHASessionStatus.STOPPED) {
        sessionConfig = this.sessions[sessionName].sessionConfig;
        me = await this.sessions[sessionName]
          .getSessionMeInfo()
          .catch((err) => null);
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
}
