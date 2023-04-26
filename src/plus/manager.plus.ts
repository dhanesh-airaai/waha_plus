import {ConsoleLogger, Injectable, NotFoundException} from "@nestjs/common";
import {WhatsappConfigService} from "../config.service";
import {WAHAInternalEvent, WhatsappSession} from "../core/abc/session.abc";
import {LocalMediaStorage} from "./storage.local";
import {WhatsappEngine} from "../structures/enums.dto";
import {SessionDTO, SessionStartRequest, SessionStopRequest} from "../structures/sessions.dto";
import {SessionManager} from "../core/abc/manager.abc";
import {WebhookConductorPlus} from "./webhooks.plus";
import {WhatsappSessionWebJSPlus} from "./session.webjs.plus";
import {WhatsappSessionVenomPlus} from "./session.venom.plus";
import {WhatsappSessionNoWebPlus} from "./session.noweb.plus";

@Injectable()
export class SessionManagerPlus extends SessionManager {
    private readonly sessions: Record<string, WhatsappSession>;

    // @ts-ignore
    protected MediaStorageClass = LocalMediaStorage
    // @ts-ignore
    protected WebhookConductorClass = WebhookConductorPlus
    protected readonly EngineClass: typeof WhatsappSession;

    constructor(
        private config: WhatsappConfigService,
        private log: ConsoleLogger,
    ) {
        super()
        this.log.setContext('SessionManager')
        this.sessions = {}
        this.EngineClass = this.getEngine(this.config.getDefaultEngineName())

        this.clearStorage()

        // Start session from the start
        if (config.startSession) {
            this.start({name: config.startSession})
        }
    }


    protected getEngine(engine: WhatsappEngine): typeof WhatsappSession {
        if (engine === WhatsappEngine.WEBJS) {
            return WhatsappSessionWebJSPlus
        } else if (engine === WhatsappEngine.VENOM) {
            return WhatsappSessionVenomPlus
        } else if (engine === WhatsappEngine.NOWEB) {
            return WhatsappSessionNoWebPlus
        } else {
            throw new NotFoundException(`Unknown whatsapp engine '${engine}'.`)
        }
    }

    start(request: SessionStartRequest) {
        const name = request.name

        this.log.log(`'${name}' - starting session...`)
        const log = new ConsoleLogger(`WhatsappSession - ${name}`)
        const storage = new this.MediaStorageClass(
            new ConsoleLogger(`Storage - ${name}`),
            this.config.filesFolder,
            this.config.filesURL,
            this.config.filesLifetime,
            this.config.mimetypes,
        )
        const webhookLog = new ConsoleLogger(`Webhook - ${name}`)
        const webhook = new this.WebhookConductorClass(
            webhookLog,
            this.config.getWebhookUrl(),
            this.config.getWebhookEvents()
        )

        // @ts-ignore
        const session = new this.EngineClass(name, storage, log)
        this.sessions[name] = session

        session.events.on(WAHAInternalEvent.engine_start, () => webhook.configure(session))
        session.start()
        return {name: session.name, status: session.status}
    }

    getSession(name: string): WhatsappSession {
        const session = this.sessions[name]
        if (!session) {
            throw new NotFoundException(
                `We didn't find a session with name '${name}'. Please start it first by using POST /sessions/start request`,
            );
        }
        return session
    }

    async stop(request: SessionStopRequest) {
        const name = request.name
        this.log.log(`Stopping ${name} session...`)
        const session = this.getSession(name)
        await session.stop()
        this.log.log(`"${name}" has been stopped.`)
        delete this.sessions[name]
    }

    getSessions(): SessionDTO[] {
        return Object.values(this.sessions).map((session) => {
            return {name: session.name, status: session.status}
        })
    }

    async onApplicationShutdown(signal ?: string) {
        this.log.log('Stop all sessions...')
        for (const name of Object.keys(this.sessions)) {
            await this.stop({name: name})
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
        )
        storage.purge()
    }
}
