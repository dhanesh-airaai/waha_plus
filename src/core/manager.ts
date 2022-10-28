import fs = require('fs');
import del = require("del");
import {ConsoleLogger, Injectable, NotFoundException, OnApplicationShutdown} from "@nestjs/common";
import {WhatsappConfigService} from "../config.service";
import {WhatsappSession} from "./session";
import {WebhookConductor} from "./webhooks";
import {WhatsappSessionWebJS} from "./session.webjs";

@Injectable()
export class WhatsappSessionManager implements OnApplicationShutdown {
    private readonly sessions: Record<string, WhatsappSession>;
    private webhook: WebhookConductor

    constructor(
        private config: WhatsappConfigService,
        private log: ConsoleLogger,
    ) {
        this.log.setContext('WhatsappSessionManager')
        this.cleanDownloadsFolder(this.config.filesFolder)
        this.sessions = {}
        this.webhook = new WebhookConductor(this.config)

        if (config.startSession) {
            this.startSession(config.startSession)
        }
    }

    startSession(name: string) {
        this.log.log(`Starting ${name} session...`)
        const session = new WhatsappSessionWebJS(this.config, name)
        session.start()
        this.sessions[name] = session
        this.webhook.configure(session)
    }

    getSession(name: string): WhatsappSession {
        const session = this.sessions[name]
        if (!session) {
            throw new NotFoundException(
                `We didn't find a session with name "${name}". 
                Please start it first by using POST /sessions/start request`,
            );
        }
        return session
    }

    getInstance(name: string): any {
        const service = this.getSession(name)
        return service.getWhatsapp()
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

    private cleanDownloadsFolder(filesFolder) {
        if (fs.existsSync(filesFolder)) {
            del([`${filesFolder}/*`], {force: true}).then((paths) =>
                console.log('Deleted files and directories:\n', paths.join('\n'))
            )
        } else {
            fs.mkdirSync(filesFolder)
            this.log.log(`Directory '${filesFolder}' created from scratch`)
        }
    }
}
