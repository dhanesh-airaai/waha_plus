import {Hooks, WhatsappStatus} from "../structures/enums.dto";
import {ConsoleLogger} from "@nestjs/common";
import {LocalMediaStorage} from "./storage";
import {
    ChatRequest,
    CheckNumberStatusQuery,
    MessageContactVcardRequest,
    MessageFileRequest,
    MessageImageRequest,
    MessageLinkPreviewRequest,
    MessageLocationRequest,
    MessageReplyRequest,
    MessageTextButtonsRequest,
    MessageTextRequest
} from "../structures/requests.dto";

export abstract class WhatsappSession {
    public status: WhatsappStatus;
    protected log: ConsoleLogger;

    public constructor(public name: string, protected storage: LocalMediaStorage) {
        this.name = name
        this.status = WhatsappStatus.STARTING
        this.log = new ConsoleLogger()
        this.log.setContext(`WhatsappService - ${this.name}`)
    }

    /** Start the session */
    abstract start()

    /** Stop the session */
    abstract stop()

    /** Subscribe the handler to specific hook */
    abstract subscribe(hook: Hooks | string, handler: (message) => void)

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

    abstract reply(request: MessageReplyRequest)

    abstract sendSeen(chat: ChatRequest)

    abstract startTyping(chat: ChatRequest)

    abstract stopTyping(chat: ChatRequest)
    /**
     * STOP - Methods for API
     */

}


