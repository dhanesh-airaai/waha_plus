import {OnApplicationShutdown} from "@nestjs/common";
import {SessionDTO, SessionStartRequest, SessionStopRequest} from "../../structures/sessions.dto";
import {WhatsappSession} from "./session.abc";

export abstract class SessionManager implements OnApplicationShutdown {
    abstract start(request: SessionStartRequest): SessionDTO

    abstract stop(request: SessionStopRequest): void

    abstract getSession(name: string): WhatsappSession

    abstract getSessions(): SessionDTO[]

    abstract onApplicationShutdown(signal ?: string)
}
