import {WhatsappStatus} from "./enums.dto";

export class SessionStartRequest {
    name: string
}

export class SessionStopRequest {
    name: string
}

export class SessionDTO {
    name: string
    status: WhatsappStatus
}
