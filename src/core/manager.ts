import {ConsoleLogger, Injectable, NotFoundException, OnApplicationShutdown} from "@nestjs/common";
import {WhatsappConfigService} from "../config.service";
import {WhatsappSession} from "./session";
import {WebhookConductor} from "./webhooks";
import {WhatsappSessionWebJS} from "./session.webjs";
import {LocalMediaStorage} from "./storage";
import {WhatsappEngine} from "../structures/enums.dto";
import {WhatsappSessionVenom} from "./session.venom";
import {SessionDTO, SessionStartRequest, SessionStopRequest} from "../structures/sessions.dto";

@Injectable()
export class WhatsappSessionManager implements OnApplicationShutdown {
    private readonly sessions: Record<string, WhatsappSession>;
    private webhook: WebhookConductor
    private readonly storage: LocalMediaStorage;
    private readonly defaultEngine: typeof WhatsappSession;

    constructor(
        private config: WhatsappConfigService,
        private log: ConsoleLogger,
    ) {
        this.log.setContext('WhatsappSessionManager')
        this.storage = new LocalMediaStorage(
            this.config.filesFolder,
            this.config.filesURL,
            this.config.filesLifetime,
            this.config.mimetypes,
        )
        this.sessions = {}
        this.webhook = new WebhookConductor(this.config.getWebhookUrl(), this.config.getWebhookEvents())
        this.defaultEngine = this.getEngine(this.config.getDefaultEngineName())

        if (config.startSession) {
            this.start({name: config.startSession})
        }
    }

    private getEngine(engine: WhatsappEngine): typeof WhatsappSession {
        if (engine === WhatsappEngine.WEBJS) {
            return WhatsappSessionWebJS
        } else if (engine === WhatsappEngine.VENOM) {
            return WhatsappSessionVenom
        } else {
            throw new NotFoundException(`Unknown whatsapp engine '${engine}'.`)
        }
    }

    start(request: SessionStartRequest) {
        const name = request.name
        this.log.log(`'${name}' - staring session...`)
        // @ts-ignore
        const session = new this.defaultEngine(name, this.storage)
        this.sessions[name] = session
        session.start().then(() => {
            this.webhook.configure(session)
        })
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

}
