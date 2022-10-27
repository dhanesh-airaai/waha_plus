//
// Queries
//
import {IsNotEmpty, IsString} from "class-validator";
import {WHATSAPP_DEFAULT_SESSION_NAME} from "./base";

export class SessionQuery {
    @IsNotEmpty()
    sessionName: string = WHATSAPP_DEFAULT_SESSION_NAME;
}

export class CheckNumberStatusQuery extends SessionQuery {
    @IsString()
    phone: string
}

export class MessageTextQuery extends SessionQuery {
    @IsString()
    phone: string
    @IsString()
    text: string
}
