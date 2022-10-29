import {WhatsappSession} from "./session";
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
import {WANumberExistResult} from "../structures/WA.dto";
import {ensureSuffix} from "../utils";
import {Whatsapp} from "venom-bot";
import {Hooks} from "../structures/enums.dto";
import {NotImplementedByEngine} from "./exceptions";


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

    getWhatsapp() {
        return this.whatsapp
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

    sendContactVCard(message: MessageContactVcardRequest) {
        return this.whatsapp.sendContactVcard(message.chatId, message.contactsId, message.name)
    }

    sendText(message: MessageTextRequest) {
        return Promise.resolve(undefined);
    }

    reply(message: MessageReplyRequest) {
        return this.whatsapp.reply(message.chatId, message.text, message.reply_to)
    }

    sendFile(message: MessageFileRequest) {
        throw new NotImplementedByEngine()
    }

    sendImage(message: MessageImageRequest) {
        throw new NotImplementedByEngine()
    }

    sendLinkPreview(message: MessageLinkPreviewRequest) {
        return this.whatsapp.sendLinkPreview(message.chatId, message.url, message.title)
    }

    sendLocation(message: MessageLocationRequest) {
        return this.whatsapp.sendLocation(message.chatId, message.latitude, message.longitude, message.title)
    }

    sendSeen(chat: ChatRequest) {
        return this.whatsapp.sendSeen(chat.chatId)
    }

    sendTextButtons(message: MessageTextButtonsRequest) {
        return this.whatsapp.sendButtons(ensureSuffix(message.chatId), message.title, message.buttons, message.text)
    }

    startTyping(chat: ChatRequest) {
        return this.whatsapp.startTyping(chat.chatId)
    }

    stopTyping(chat: ChatRequest) {
        return  this.whatsapp.stopTyping(chat.chatId)
    }

    /**
     * STOP - Methods for API
     */

}
