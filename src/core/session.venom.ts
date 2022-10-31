import {WhatsappSession} from "./session";
import {
    Button,
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
    MessageTextRequest
} from "../structures/requests.dto";
import {WANumberExistResult} from "../structures/WA.dto";
import {ensureSuffix} from "../utils";
import {Whatsapp} from "venom-bot";
import {Hooks} from "../structures/enums.dto";
import {NotImplementedByEngineError} from "./exceptions";


export class WhatsappSessionVenom extends WhatsappSession {
    whatsapp: Whatsapp;

    start() {
        return
    }

    stop() {
        return
    }

    subscribe(hook: Hooks | string, handler: (message) => void) {
        return
    }


    /**
     * START - Methods for API
     */
    getScreenshot(): Promise<Buffer | string> {
        return Promise.resolve(undefined);
    }

    async checkNumberStatus(request: CheckNumberStatusQuery): Promise<WANumberExistResult> {
        try {
            const result = await this.whatsapp.checkNumberStatus(ensureSuffix(request.phone))
            return {numberExists: result['numberExists']}
        } catch (error) {
            // We need to "touch" the error in order to get unhandled rejections
            // It logs out the session and stop the app
            console.log(typeof error)
            console.log(error)
            return {numberExists: false}
        }
    }

    sendContactVCard(request: MessageContactVcardRequest) {
        return this.whatsapp.sendContactVcard(request.chatId, request.contactsId, request.name)
    }

    sendText(request: MessageTextRequest) {
        return Promise.resolve(undefined);
    }

    reply(request: MessageReplyRequest) {
        return this.whatsapp.reply(request.chatId, request.text, request.reply_to)
    }

    sendFile(request: MessageFileRequest) {
        throw new NotImplementedByEngineError()
    }

    sendImage(request: MessageImageRequest) {
        throw new NotImplementedByEngineError()
    }

    async sendVoice(request) {
        throw new NotImplementedByEngineError()
    }

    sendLinkPreview(request: MessageLinkPreviewRequest) {
        return this.whatsapp.sendLinkPreview(request.chatId, request.url, request.title)
    }

    sendLocation(request: MessageLocationRequest) {
        return this.whatsapp.sendLocation(request.chatId, request.latitude, request.longitude, request.title)
    }

    sendSeen(chat: ChatRequest) {
        return this.whatsapp.sendSeen(chat.chatId)
    }

    sendTextButtons(request: MessageTextButtonsRequest) {
        const buttons = request.buttons.map((button: Button) => {
            return {
                buttonId: button.id,
                buttonText: {
                    displayText: button.body
                }
            }
        })
        return this.whatsapp.sendButtons(ensureSuffix(request.chatId), request.title, buttons, request.text)
    }

    startTyping(chat: ChatRequest) {
        return this.whatsapp.startTyping(chat.chatId)
    }

    stopTyping(chat: ChatRequest) {
        return this.whatsapp.stopTyping(chat.chatId)
    }

    setReaction(request: MessageReactionRequest) {
        throw new NotImplementedByEngineError()
    }

    /**
     * STOP - Methods for API
     */

}
