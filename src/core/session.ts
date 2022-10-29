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

    /** Get actual whatsapp instance */
    // TODO: Remove it in order to add more functions
    abstract getWhatsapp()

    /**
     * START - Methods for API
     */
    abstract getScreenshot(): Promise<Buffer | string>

    abstract checkNumberStatus(request: CheckNumberStatusQuery)

    abstract sendText(message: MessageTextRequest)

    abstract sendContactVCard(message: MessageContactVcardRequest)

    abstract sendTextButtons(message: MessageTextButtonsRequest)

    abstract sendLocation(message: MessageLocationRequest)

    abstract sendLinkPreview(message: MessageLinkPreviewRequest)

    abstract sendImage(message: MessageImageRequest)

    abstract sendFile(message: MessageFileRequest)

    abstract reply(message: MessageReplyRequest)

    abstract sendSeen(chat: ChatRequest)

    abstract startTyping(chat: ChatRequest)

    abstract stopTyping(chat: ChatRequest)
    /**
     * STOP - Methods for API
     */

}


