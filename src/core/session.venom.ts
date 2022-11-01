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
import {create, Whatsapp} from "venom-bot";
import {WAEvents, WhatsappStatus} from "../structures/enums.dto";
import {NotImplementedByEngineError} from "./exceptions";
import {LocalMediaStorage} from "./storage";
import {UnprocessableEntityException} from "@nestjs/common/exceptions/unprocessable-entity.exception";

class QR {
    private base64: string;

    save(base64) {
        this.base64 = base64.replace(/^data:image\/png;base64,/, '');
    }

    get(): Buffer {
        return Buffer.from(this.base64, "base64")
    }

}

export class WhatsappSessionVenom extends WhatsappSession {
    whatsapp: Whatsapp;
    private qr: QR

    public constructor(public name: string, protected storage: LocalMediaStorage) {
        super(name, storage);
        this.qr = new QR()
    }

    async start() {
        try {
            this.whatsapp = await create('sessionName',
                (base64Qrimg, asciiQR, attempts, urlCode) => {
                    this.qr.save(base64Qrimg)
                    this.status = WhatsappStatus.SCAN_QR_CODE
                    this.log.debug('Number of attempts to read the qrcode: ', attempts);
                    this.log.log('Terminal qrcode:');
                    // Log QR image in console without this.log to make it pretty
                    console.log(asciiQR);
                },
                undefined,
                {
                    headless: true,
                    devtools: false,
                    useChrome: true,
                    debug: false,
                    logQR: true,
                    browserArgs: ["--no-sandbox"],
                    autoClose: 60000,
                    createPathFileToken: true,
                    puppeteerOptions: {},
                    multidevice: false,
                }
            )
        } catch (error) {
            this.status = WhatsappStatus.FAILED
            this.log.error(error)
            this.qr.save("")
            return
        }

        this.status = WhatsappStatus.WORKING
    }


    stop() {
        return this.whatsapp.close()
    }

    subscribe(hook: WAEvents | string, handler: (message) => void) {
        return
    }


    /**
     * START - Methods for API
     */
    getScreenshot(): Promise<Buffer | string> {
        if (this.status === WhatsappStatus.STARTING) {
            throw new UnprocessableEntityException(`The session is starting, please try again after few seconds`);
        } else if (this.status === WhatsappStatus.SCAN_QR_CODE) {
            return Promise.resolve(this.qr.get())
        } else if (this.status === WhatsappStatus.WORKING) {
            return this.whatsapp.page.screenshot()
        } else {
            throw new UnprocessableEntityException(`Unknown status - ${this.status}`);
        }
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
