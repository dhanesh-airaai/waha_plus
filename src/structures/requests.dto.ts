import {IsNotEmpty, IsString} from "class-validator";
import {ApiExtraModels, ApiProperty, getSchemaPath} from "@nestjs/swagger";

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
    sessionName = "default"
}

export class ChatRequest extends SessionRequest {
    @chatIdProperty
    chatId: string;
}

export class MessageContactVcardRequest extends ChatRequest {
    contactsId: string;
    name: string
}

export class MessageTextRequest extends ChatRequest {
    text: string;
}

export class Button {
    id: string
    body: string
}

export class MessageTextButtonsRequest extends ChatRequest {
    title: string;
    text: string;
    buttons?: Array<Button>;
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

export class RemoteFile {
    @ApiProperty({
        example: 'https://picsum.photos/200/300',
    })
    url: string

    @ApiProperty({
        description: "MIME type of the attachment. Use 'audio/ogg; codecs=opus' for a voice message",
        example: 'image/jpeg',
    })
    mimetype: string

    @ApiProperty({
        description: "Document file name. Value can be null",
        example: 'filename.jpg',
    })
    filename?: string | null
}

export class BinaryFile {
    @ApiProperty({
        description: "Base64-encoded data of the file",
        example: 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB3aWR0aD0iODIiIGhlaWdodD0iMjAiIHJvbGU9ImltZyIgYXJpYS1sYWJlbD0iZGV2OiBsaWtlYXBybyI+PHRpdGxlPmRldjogbGlrZWFwcm88L3RpdGxlPjxsaW5lYXJHcmFkaWVudCBpZD0icyIgeDI9IjAiIHkyPSIxMDAlIj48c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiNiYmIiIHN0b3Atb3BhY2l0eT0iLjEiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3Atb3BhY2l0eT0iLjEiLz48L2xpbmVhckdyYWRpZW50PjxjbGlwUGF0aCBpZD0iciI+PHJlY3Qgd2lkdGg9IjgyIiBoZWlnaHQ9IjIwIiByeD0iMyIgZmlsbD0iI2ZmZiIvPjwvY2xpcFBhdGg+PGcgY2xpcC1wYXRoPSJ1cmwoI3IpIj48cmVjdCB3aWR0aD0iMjkiIGhlaWdodD0iMjAiIGZpbGw9IiM1NTUiLz48cmVjdCB4PSIyOSIgd2lkdGg9IjUzIiBoZWlnaHQ9IjIwIiBmaWxsPSJibGFjayIvPjxyZWN0IHdpZHRoPSI4MiIgaGVpZ2h0PSIyMCIgZmlsbD0idXJsKCNzKSIvPjwvZz48ZyBmaWxsPSIjZmZmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iVmVyZGFuYSxHZW5ldmEsRGVqYVZ1IFNhbnMsc2Fucy1zZXJpZiIgdGV4dC1yZW5kZXJpbmc9Imdlb21ldHJpY1ByZWNpc2lvbiIgZm9udC1zaXplPSIxMTAiPjx0ZXh0IGFyaWEtaGlkZGVuPSJ0cnVlIiB4PSIxNTUiIHk9IjE1MCIgZmlsbD0iIzAxMDEwMSIgZmlsbC1vcGFjaXR5PSIuMyIgdHJhbnNmb3JtPSJzY2FsZSguMSkiIHRleHRMZW5ndGg9IjE5MCI+ZGV2PC90ZXh0Pjx0ZXh0IHg9IjE1NSIgeT0iMTQwIiB0cmFuc2Zvcm09InNjYWxlKC4xKSIgZmlsbD0iI2ZmZiIgdGV4dExlbmd0aD0iMTkwIj5kZXY8L3RleHQ+PHRleHQgYXJpYS1oaWRkZW49InRydWUiIHg9IjU0NSIgeT0iMTUwIiBmaWxsPSIjMDEwMTAxIiBmaWxsLW9wYWNpdHk9Ii4zIiB0cmFuc2Zvcm09InNjYWxlKC4xKSIgdGV4dExlbmd0aD0iNDMwIj5saWtlYXBybzwvdGV4dD48dGV4dCB4PSI1NDUiIHk9IjE0MCIgdHJhbnNmb3JtPSJzY2FsZSguMSkiIGZpbGw9IiNmZmYiIHRleHRMZW5ndGg9IjQzMCI+bGlrZWFwcm88L3RleHQ+PC9nPjwvc3ZnPg==',
    })
    data: string

    @ApiProperty({
        description: "MIME type of the attachment. Use 'audio/ogg; codecs=opus' for a voice message",
        example: 'image/svg+xml',
    })
    mimetype: string
    @ApiProperty({
        description: "Document file name. Value can be null",
        example: 'filename.svg',
    })
    filename?: string | null
}

@ApiExtraModels(BinaryFile, RemoteFile)
export class MessageImageRequest extends ChatRequest {
    @ApiProperty({
        oneOf: [
            {$ref: getSchemaPath(BinaryFile)},
            {$ref: getSchemaPath(RemoteFile)},
        ],
    })
    file: RemoteFile | BinaryFile
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
