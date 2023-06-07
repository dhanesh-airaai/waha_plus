import { ConsoleLogger, Injectable, NotFoundException } from '@nestjs/common';
import { WhatsappConfigService } from '../config.service';
import {
  ProxyConfig,
  WAHAInternalEvent,
  WhatsappSession,
  WhatsAppSessionConfig,
} from '../core/abc/session.abc';
import { MediaStoragePlus, SessionStoragePlus } from './storage.plus';
import { WhatsappEngine, WhatsappStatus } from '../structures/enums.dto';
import {
  SessionDTO,
  SessionLogoutRequest,
  SessionStartRequest,
  SessionStopRequest,
} from '../structures/sessions.dto';
import { SessionManager } from '../core/abc/manager.abc';
import { WebhookConductorPlus } from './webhooks.plus';
import { WhatsappSessionWebJSPlus } from './session.webjs.plus';
import { WhatsappSessionVenomPlus } from './session.venom.plus';
import { WhatsappSessionNoWebPlus } from './session.noweb.plus';
import { LocalSessionStorage } from '../core/abc/storage.abc';
import * as lodash from 'lodash';
import { getProxyConfig } from 'src/core/helpers.proxy';

@Injectable()
export class SessionManagerPlus extends SessionManager {
  private readonly sessions: Record<string, WhatsappSession>;

  // @ts-ignore
  protected MediaStorageClass = MediaStoragePlus;
  // @ts-ignore
  protected WebhookConductorClass = WebhookConductorPlus;
  protected readonly EngineClass: typeof WhatsappSession;
  protected sessionStorage: LocalSessionStorage;

  constructor(
    private config: WhatsappConfigService,
    private log: ConsoleLogger,
  ) {
    super();
    this.log.setContext('SessionManager');
    this.sessions = {};
    const engineName = this.config.getDefaultEngineName();
    this.EngineClass = this.getEngine(engineName);
    this.sessionStorage = new SessionStoragePlus(engineName.toLowerCase());
    this.sessionStorage.init();

    this.clearStorage();
    this.restartStoppedSessions();
    this.startPredefinedSessions();
  }

  protected restartStoppedSessions() {
    if (!this.config.shouldRestartAllSessions) {
      return;
    }

    const stoppedSessions = this.sessionStorage.getAll();
    stoppedSessions.forEach((sessionName) => {
      this.log.log(`Restarting STOPPED session - ${sessionName}...`);
      this.start({ name: sessionName });
    });
  }

  protected startPredefinedSessions() {
    const startSessions = this.config.startSessions;
    startSessions.forEach((sessionName) => {
      // Do not start already started session
      if (this.sessions[sessionName]) {
        return;
      }
      this.start({ name: sessionName });
    });
  }

  protected getEngine(engine: WhatsappEngine): typeof WhatsappSession {
    if (engine === WhatsappEngine.WEBJS) {
      return WhatsappSessionWebJSPlus;
    } else if (engine === WhatsappEngine.VENOM) {
      return WhatsappSessionVenomPlus;
    } else if (engine === WhatsappEngine.NOWEB) {
      return WhatsappSessionNoWebPlus;
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
    /* We need to clear the local storage just once */
    const storage = new this.MediaStorageClass(
      new ConsoleLogger(`Storage`),
      this.config.filesFolder,
      this.config.filesURL,
      this.config.filesLifetime,
      this.config.mimetypes,
    );
    storage.purge();
  }

  //
  // API Methods
  //
  start(request: SessionStartRequest) {
    const name = request.name;

    this.log.log(`'${name}' - starting session...`);
    const log = new ConsoleLogger(`WhatsappSession - ${name}`);
    const storage = new this.MediaStorageClass(
      new ConsoleLogger(`Storage - ${name}`),
      this.config.filesFolder,
      this.config.filesURL,
      this.config.filesLifetime,
      this.config.mimetypes,
    );
    const webhookLog = new ConsoleLogger(`Webhook - ${name}`);
    const webhook = new this.WebhookConductorClass(
      webhookLog,
      this.config.getWebhookUrl(),
      this.config.getWebhookEvents(),
    );

    const sessionConfig: WhatsAppSessionConfig = {
      name,
      storage,
      log,
      sessionStorage: this.sessionStorage,
      proxyConfig: this.getProxyConfig(name),
    };
    // @ts-ignore
    const session = new this.EngineClass(sessionConfig);
    this.sessions[name] = session;

    session.events.on(WAHAInternalEvent.engine_start, () =>
      webhook.configure(session),
    );
    session.start();
    return { name: session.name, status: session.status };
  }

  private getProxyConfig(sessionName: string): ProxyConfig | undefined {
    return getProxyConfig(this.config, this.sessions, sessionName);
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
    this.sessionStorage.clean(request.name);
  }

  getSession(name: string, error = true): WhatsappSession {
    const session = this.sessions[name];
    if (!session) {
      if (error) {
        throw new NotFoundException(
          `We didn't find a session with name '${name}'. Please start it first by using POST /sessions/start request`,
        );
      }
      return;
    }
    return session;
  }

  getSessions(all): SessionDTO[] {
    let sessionNames = Object.keys(this.sessions);
    if (all) {
      const stoppedSession = this.sessionStorage.getAll();
      sessionNames = lodash.union(sessionNames, stoppedSession);
    }

    return sessionNames.map((sessionName) => {
      return {
        name: sessionName,
        status: this.sessions[sessionName]?.status || WhatsappStatus.STOPPED,
      };
    });
  }
}
