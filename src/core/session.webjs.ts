import {UnprocessableEntityException} from "@nestjs/common/exceptions/unprocessable-entity.exception";
import {Chat, Client, Events, LocalAuth, Message, MessageMedia} from "whatsapp-web.js";
import {Hooks, WhatsappStatus} from "../structures/enums.dto";
import {WhatsappSession} from "./session";
import {WAMessage, WANumberExistResult} from "../structures/WA.dto";
import {ensureSuffix} from "../utils";
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
import {NotImplementedByEngine} from "./exceptions";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcode = require('qrcode-terminal');


export class WhatsappSessionWebJS extends WhatsappSession {
    whatsapp: Client;

    start() {
        this.whatsapp = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {headless: true}
        });

        this.whatsapp.initialize().catch(error => {
            this.status = WhatsappStatus.FAILED
            this.log.error(error)
            return
        });

        // Connect events
        this.whatsapp.on(Events.QR_RECEIVED, (qr) => {
            qrcode.generate(qr, {small: true});
            this.status = WhatsappStatus.SCAN_QR_CODE
        });

        this.whatsapp.on(Events.AUTHENTICATED, () => {
            this.status = WhatsappStatus.WORKING
            this.log.log(`Session '${this.name}' has been authenticated!`)
        });
    }

    stop() {
        return this.whatsapp.pupPage.close()
    }

    /**
     * START - Methods for API
     */
    async getScreenshot(): Promise<Buffer | string> {
        if (this.status === WhatsappStatus.FAILED) {
            throw new UnprocessableEntityException(`The session under FAILED status. Please try to restart it.`);
        }
        return await this.whatsapp.pupPage.screenshot()
    }

    checkNumberStatus(request: CheckNumberStatusQuery): Promise<WANumberExistResult> {
        throw new NotImplementedByEngine()
    }

    sendText(message: MessageTextRequest): Promise<WAMessage> {
        return this.whatsapp.sendMessage(ensureSuffix(message.chatId), message.text).then(this.toWAMessage)
    }

    sendTextButtons(message: MessageTextButtonsRequest) {
        throw new NotImplementedByEngine()
    }

    sendContactVCard(message: MessageContactVcardRequest) {
        throw new NotImplementedByEngine()
    }

    reply(message: MessageReplyRequest) {
        throw new NotImplementedByEngine()
    }

    sendFile(message: MessageFileRequest) {
        throw new NotImplementedByEngine()
    }

    sendImage(message: MessageImageRequest) {
        throw new NotImplementedByEngine()
    }

    sendLinkPreview(message: MessageLinkPreviewRequest) {
        throw new NotImplementedByEngine()
    }

    sendLocation(message: MessageLocationRequest) {
        throw new NotImplementedByEngine()
    }

    async sendSeen(request: ChatRequest) {
        const chat: Chat = await this.whatsapp.getChatById(request.chatId)
        await chat.sendSeen()
    }

    async startTyping(request: ChatRequest) {
        const chat: Chat = await this.whatsapp.getChatById(request.chatId)
        await chat.sendStateTyping()
    }

    async stopTyping(request: ChatRequest) {
        const chat: Chat = await this.whatsapp.getChatById(request.chatId)
        await chat.clearState()
    }

    /**
     * STOP - Methods for API
     */

    /**
     Get venom instance if it's working (with no QR code required)
     */
    getWhatsapp() {
        if (this.status != WhatsappStatus.WORKING) {
            throw new UnprocessableEntityException(
                `The session status is "${this.status}". Please scan QR code first by using GET /screenshot method.`,
            );
        }
        return this.whatsapp

    }

    subscribe(hook, handler) {
        if (hook === Hooks.ON_MESSAGE) {
            this.whatsapp.on(Events.MESSAGE_RECEIVED, (message) => this.processMessage(message).then(handler))
        } else if (hook === Hooks.ON_ANY_MESSAGE_HOOK) {
            this.whatsapp.on(Events.MESSAGE_CREATE, (message) => this.processMessage(message).then(handler))
        } else if (hook === Hooks.ON_STATE_CHANGE) {
            this.whatsapp.on(Events.STATE_CHANGED, handler)
        } else if (hook === Hooks.ON_ACK) {
            // We do not download media here
            this.whatsapp.on(Events.MESSAGE_ACK, (message) => this.toWAMessage(message).then(handler))
        } else if (hook === Hooks.ON_ADDED_TO_GROUP) {
            this.whatsapp.on(Events.GROUP_JOIN, handler)
        } else if (hook === Hooks.ON_REMOVED_FROM_GROUP) {
            this.whatsapp.on(Events.GROUP_LEAVE, handler)
        }
    }

    private processMessage(message: Message) {
        return this.downloadAndDecryptMedia(message).then(this.toWAMessage)
    }

    protected toWAMessage(message: Message): Promise<WAMessage> {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return Promise.resolve({
            id: message.id._serialized,
            timestamp: message.timestamp,
            from: message.from,
            fromMe: message.fromMe,
            to: message.to,
            body: message.body,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            hasMedia: Boolean(message.mediaUrl),
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            mediaUrl: message.mediaUrl,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            ack: message.ack,
            location: message.location,
            vCards: message.vCards,
            _data: message.rawData,
        })
    }

    private async downloadAndDecryptMedia(message: Message) {
        if (!message.hasMedia) {
            return message
        }

        this.log.log(`The message ${message.id._serialized} has media, downloading it...`);
        return message.downloadMedia().then(async (media: MessageMedia) => {
            this.log.verbose(`Writing file from the message ${message.id}...`)
            const buffer = Buffer.from(media.data, "base64")
            const url = await this.storage.save(message.id._serialized, media.mimetype, buffer)
            this.log.log(`The file from ${message.id} has been saved to ${url}`);

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            message.mediaUrl = url
            return message
        })

    }

}

