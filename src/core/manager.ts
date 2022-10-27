import fs = require('fs');
import del = require("del");
import {ConsoleLogger, Injectable, NotFoundException, OnApplicationShutdown} from "@nestjs/common";
import {WhatsappConfigService} from "../config.service";
import {Whatsapp} from "venom-bot";
import {WhatsappSession} from "./session";

@Injectable()
export class WhatsappSessionManager implements OnApplicationShutdown {
    private readonly sessions: Record<string, WhatsappSession>;

    constructor(
        private config: WhatsappConfigService,
        private log: ConsoleLogger,
    ) {
        this.log.setContext('WhatsappSessionManager')
        this.cleanDownloadsFolder(this.config.filesFolder)
        this.sessions = {}
        if (config.startSession) {
            this.startSession(config.startSession)
        }
    }

    startSession(name: string) {
        this.log.log(`Starting ${name} session...`)
        const session = new WhatsappSession(this.config, name)
        session.start()
        this.sessions[name] = session
    }

    getService(name: string): WhatsappSession {
        const session = this.sessions[name]
        if (!session) {
            throw new NotFoundException(
                `We didn't find a session with name "${name}". Please start it first by using POST /sessions/start request`,
            );
        }
        return session
    }

    getInstance(name: string): Whatsapp {
        const service = this.getService(name)
        return service.getWhatsapp()
    }

    async stopSession(name: string) {
        this.log.log(`Stopping ${name} session...`)
        const service = this.getService(name)
        if (service.whatsapp) {
            await service.whatsapp.close()
        }
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
