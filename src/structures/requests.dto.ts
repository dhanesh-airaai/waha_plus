import {IsNotEmpty, IsString} from "class-validator";
import {ApiProperty} from "@nestjs/swagger";

export const WHATSAPP_DEFAULT_SESSION_NAME = "default"

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

const chatIdProperty = ApiProperty({
    example: '791231234567@c.us'
})
const sessionNameProperty = ApiProperty({
    default: WHATSAPP_DEFAULT_SESSION_NAME,
})

export class SessionRequest {
    @sessionNameProperty
    sessionName: string;
}

export class ChatRequest extends SessionRequest {
    @chatIdProperty
    chatId: string;
}

export class MessageContactVcard extends ChatRequest {
    contactsId: string;
    name: string
}

export class MessageTextRequest extends ChatRequest {
    text: string;
}

export class MessageTextButtonsRequest extends ChatRequest {
    text: string;
    title: string;
    buttons: any[];
}

export class MessageReplyRequest extends ChatRequest {
    text: string;
    @ApiProperty({
        example: 'message.id',
    })
    reply_to: string;
}

export class MessageLocationRequest extends ChatRequest {
    latitude: string;
    longitude: string;
    title: string;
}

export class MessageImageRequest extends ChatRequest {
    path: string;
    filename: string;
    caption: string;
}

export class MessageFileRequest extends ChatRequest {
    path: string;
    filename: string;
    caption: string;
}

export class MessageLinkPreviewRequest extends ChatRequest {
    url: string;
    title: string;
}
