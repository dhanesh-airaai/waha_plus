import {WAEvents, WhatsappStatus} from "../../structures/enums.dto";
import {ConsoleLogger} from "@nestjs/common";
import {LocalMediaStorage} from "../storage";
import {
    ChatRequest,
    CheckNumberStatusQuery,
    MessageContactVcardRequest,
    MessageFileRequest,
    MessageImageRequest,
    MessageLinkPreviewRequest,
    MessageLocationRequest,
    MessageReactionRequest,
    MessageReplyRequest,
    MessageTextButtonsRequest,
    MessageTextRequest,
    MessageVoiceRequest
} from "../../structures/chatting.dto";

export abstract class WhatsappSession {
    public status: WhatsappStatus;

    public constructor(public name: string, protected storage: LocalMediaStorage, protected log: ConsoleLogger) {
        this.name = name
        this.status = WhatsappStatus.STARTING
        this.log = log
    }

    /** Start the session */
    abstract start()

    /** Stop the session */
    abstract stop(): void

    /** Subscribe the handler to specific hook */
    abstract subscribe(hook: WAEvents | string, handler: (message) => void)

    /**
     * START - Methods for API
     */
    abstract getScreenshot(): Promise<Buffer | string>

    abstract checkNumberStatus(request: CheckNumberStatusQuery)

    abstract sendText(request: MessageTextRequest)

    abstract sendContactVCard(request: MessageContactVcardRequest)

    abstract sendTextButtons(request: MessageTextButtonsRequest)

    abstract sendLocation(request: MessageLocationRequest)

    abstract sendLinkPreview(request: MessageLinkPreviewRequest)

    abstract sendImage(request: MessageImageRequest)

    abstract sendFile(request: MessageFileRequest)

    abstract sendVoice(request: MessageVoiceRequest)

    abstract reply(request: MessageReplyRequest)

    abstract sendSeen(chat: ChatRequest)

    abstract startTyping(chat: ChatRequest)

    abstract stopTyping(chat: ChatRequest)

    abstract setReaction(request: MessageReactionRequest)
    /**
     * STOP - Methods for API
     */

}


