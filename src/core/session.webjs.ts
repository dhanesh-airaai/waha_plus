import {UnprocessableEntityException} from "@nestjs/common/exceptions/unprocessable-entity.exception";
import {Buttons, Chat, Client, Events, LocalAuth, Message, MessageId, MessageMedia} from "whatsapp-web.js";
import {Message as MessageInstance} from "whatsapp-web.js/src/structures"
import {WAEvents, WhatsappStatus} from "../structures/enums.dto";
import {WhatsappSession} from "./session";
import {WAMessage, WANumberExistResult} from "../structures/WA.dto";
import {ensureSuffix} from "../utils";
import {
    BinaryFile,
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
    RemoteFile
} from "../structures/requests.dto";
import {NotImplementedByEngineError} from "./exceptions";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcode = require('qrcode-terminal');


export class WhatsappSessionWebJS extends WhatsappSession {
    whatsapp: Client;

    start() {
        this.whatsapp = new Client({
            authStrategy: new LocalAuth({clientId: this.name}),
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
        throw new NotImplementedByEngineError()
    }

    sendText(request: MessageTextRequest): Promise<WAMessage> {
        return this.whatsapp.sendMessage(ensureSuffix(request.chatId), request.text).then(this.toWAMessage)
    }

    sendTextButtons(request: MessageTextButtonsRequest) {
        const message = new Buttons("", request.buttons, request.title, request.text)
        return this.whatsapp.sendMessage(ensureSuffix(request.chatId), message).then(this.toWAMessage)
    }

    sendContactVCard(request: MessageContactVcardRequest) {
        throw new NotImplementedByEngineError()
    }

    reply(request: MessageReplyRequest) {
        const options = {
            quotedMessageId: request.reply_to,
        };
        return this.whatsapp.sendMessage(request.chatId, request.text, options).then(this.toWAMessage)
    }

    async sendFile(request: MessageFileRequest) {
        const media = await this.fileToMedia(request.file)
        const options = {sendMediaAsDocument: true}
        return this.whatsapp.sendMessage(request.chatId, media, options).then(this.toWAMessage)
    }

    async sendImage(request: MessageImageRequest) {
        const media = await this.fileToMedia(request.file)
        const options = {media: media}
        return this.whatsapp.sendMessage(request.chatId, request.caption, options).then(this.toWAMessage)
    }

    async sendVoice(request) {
        const media = await this.fileToMedia(request.file)
        const options = {sendAudioAsVoice: true}
        return this.whatsapp.sendMessage(request.chatId, media, options).then(this.toWAMessage)
    }

    sendLinkPreview(request: MessageLinkPreviewRequest) {
        throw new NotImplementedByEngineError()
    }

    sendLocation(request: MessageLocationRequest) {
        throw new NotImplementedByEngineError()
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

    async setReaction(request: MessageReactionRequest) {
        const messageId = this.deserializeId(request.messageId)
        console.log(messageId)

        // Recreate instance to react on it
        const message = new MessageInstance(this.whatsapp)
        message.id = messageId
        message._data = {id: messageId}

        return message.react(request.reaction)
    }

    /**
     * STOP - Methods for API
     */

    subscribe(event, handler) {
        if (event === WAEvents.MESSAGE) {
            this.whatsapp.on(Events.MESSAGE_RECEIVED, (message) => this.processIncomingMessage(message).then(handler))
        } else if (event === WAEvents.MESSAGE_ANY) {
            this.whatsapp.on(Events.MESSAGE_CREATE, (message) => this.processIncomingMessage(message).then(handler))
        } else if (event === WAEvents.STATE_CHANGE) {
            this.whatsapp.on(Events.STATE_CHANGED, handler)
        } else if (event === WAEvents.MESSAGE_ACK) {
            // We do not download media here
            this.whatsapp.on(Events.MESSAGE_ACK, (message) => this.toWAMessage(message).then(handler))
        } else if (event === WAEvents.GROUP_JOIN) {
            this.whatsapp.on(Events.GROUP_JOIN, handler)
        } else if (event === WAEvents.GROUP_LEAVE) {
            this.whatsapp.on(Events.GROUP_LEAVE, handler)
        } else {
            throw new NotImplementedByEngineError(`Engine does not support webhook event: ${event}`)
        }
    }

    private processIncomingMessage(message: Message) {
        return this.downloadAndDecryptMedia(message).then(this.toWAMessage)
    }

    protected toWAMessage(message: Message): Promise<WAMessage> {
        // @ts-ignore
        return Promise.resolve({
            id: message.id._serialized,
            timestamp: message.timestamp,
            from: message.from,
            fromMe: message.fromMe,
            to: message.to,
            body: message.body,
            // @ts-ignore
            hasMedia: Boolean(message.mediaUrl),
            // @ts-ignore
            mediaUrl: message.mediaUrl,
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

            // @ts-ignore
            message.mediaUrl = url
            return message
        })

    }

    private async fileToMedia(file: BinaryFile | RemoteFile) {
        if ("url" in file) {
            const mediaOptions = {unsafeMime: true}
            const media = await MessageMedia.fromUrl(file.url, mediaOptions)
            console.log(media.mimetype)
            media.mimetype = file.mimetype || media.mimetype
            return media
        }
        return new MessageMedia(file.mimetype, file.data, file.filename)
    }

    private deserializeId(messageId: string): MessageId {
        const parts = messageId.split("_")
        return {
            "fromMe": parts[0] === "true",
            "remote": parts[1],
            "id": parts[2],
            "_serialized": messageId
        }
    }

}

