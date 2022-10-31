import {ConsoleLogger, Injectable, NotFoundException, OnApplicationShutdown} from "@nestjs/common";
import {WhatsappConfigService} from "../config.service";
import {WhatsappSession} from "./session";
import {WebhookConductor} from "./webhooks";
import {WhatsappSessionWebJS} from "./session.webjs";
import {LocalMediaStorage} from "./storage";

@Injectable()
export class WhatsappSessionManager implements OnApplicationShutdown {
    private readonly sessions: Record<string, WhatsappSession>;
    private webhook: WebhookConductor
    private readonly storage: LocalMediaStorage;

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
        this.webhook = new WebhookConductor(this.config)

        if (config.startSession) {
            this.startSession(config.startSession)
        }
    }

    startSession(name: string) {
        this.log.log(`Starting ${name} session...`)
        const session = new WhatsappSessionWebJS(name, this.storage)
        session.start()
        this.sessions[name] = session
        this.webhook.configure(session)
    }

    getSession(name: string): WhatsappSession {
        const session = this.sessions[name]
        if (!session) {
            throw new NotFoundException(
                `We didn't find a session with name "${name}". Please start it first by using POST /sessions/start request`,
            );
        }
        return session
    }

    async stopSession(name: string) {
        this.log.log(`Stopping ${name} session...`)
        const session = this.getSession(name)
        await session.stop()
        this.log.log(`"${name}" has been stopped.`)
        delete this.sessions[name]
    }

    getAllSessions() {
        return Object.values(this.sessions).map((session) => {
            return {name: session.name, status: session.status}
        })
    }

    async onApplicationShutdown(signal ?: string) {
        this.log.log('Stop all sessions...')
        for (const sessionName of Object.keys(this.sessions)) {
            await this.stopSession(sessionName)
        }
    }

}
