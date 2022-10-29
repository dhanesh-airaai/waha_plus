import {ApiProperty} from "@nestjs/swagger";

export enum WAMessageAck {
    ACK_ERROR = -1,
    ACK_PENDING = 0,
    ACK_SERVER = 1,
    ACK_DEVICE = 2,
    ACK_READ = 3,
    ACK_PLAYED = 4,
}

export class Location {
    description?: string | null
    latitude: string
    longitude: string
}


export class WAMessage {
    /** Message ID **/
    @ApiProperty({
        example: "false_71111111111@c.us_A3EB0ED453FB4DEC8AC1"
    })
    id: string

    /** Unix timestamp for when the message was created */
    timestamp: number

    /** ID for the Chat that this message was sent to, except if the message was sent by the current user */
    from: string

    /** Indicates if the message was sent by the current user */
    fromMe: boolean

    /**
     * ID for who this message is for.
     * If the message is sent by the current user, it will be the Chat to which the message is being sent.
     * If the message is sent by another user, it will be the ID for the current user.
     */
    to: string

    /** Message content */
    body: string

    /** Indicates if the message has media available for download */
    hasMedia: boolean

    /** The URL for the media in the message if any */
    mediaUrl: string

    /** ACK status for the message */
    ack: WAMessageAck

    /** If the message was sent to a group, this field will contain the user that sent the message. */
    author?: string;

    /** Location information contained in the message, if the message is type "location" */
    location: Location

    /** List of vCards contained in the message */
    vCards: string[]

    /** Returns message in a raw format */
    _data: any
}
