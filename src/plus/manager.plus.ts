import {ConsoleLogger, Injectable, NotFoundException} from "@nestjs/common";
import {WhatsappConfigService} from "../config.service";
import {WhatsappSession} from "../core/abc/session.abc";
import {WhatsappSessionWebJSCore} from "../core/session.webjs.core";
import {LocalMediaStorage} from "./storage.local";
import {WhatsappEngine} from "../structures/enums.dto";
import {WhatsappSessionVenomCore} from "../core/session.venom.core";
import {SessionDTO, SessionStartRequest, SessionStopRequest} from "../structures/sessions.dto";
import {SessionManager} from "../core/abc/manager.abc";
import {WebhookConductorPlus} from "./webhooks.plus";

@Injectable()
export class SessionManagerPlus implements SessionManager {
    private readonly sessions: Record<string, WhatsappSession>;

    // @ts-ignore
    private MediaStorageClass = LocalMediaStorage
    // @ts-ignore
    private WebhookConductorClass = WebhookConductorPlus
    private readonly EngineClass: typeof WhatsappSession;

    constructor(
        private config: WhatsappConfigService,
        private log: ConsoleLogger,
    ) {
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
            return WhatsappSessionWebJSCore
        } else if (engine === WhatsappEngine.VENOM) {
            return WhatsappSessionVenomCore
        } else {
            throw new NotFoundException(`Unknown whatsapp engine '${engine}'.`)
        }
    }

    start(request: SessionStartRequest) {
        const name = request.name

        this.log.log(`'${name}' - staring session...`)
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

        session.start().then(() => webhook.configure(session))
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
