import {UnprocessableEntityException} from "@nestjs/common/exceptions/unprocessable-entity.exception";
import {Client, Events, LocalAuth, Message, MessageMedia} from "whatsapp-web.js";
import {Hooks, WhatsappStatus} from "../structures/enums.dto";
import {WhatsappSession} from "./session";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcode = require('qrcode-terminal');


export class WhatsappSessionWebJS extends WhatsappSession {
    public whatsapp: Client;

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

    public async getScreenshot(): Promise<Buffer | string> {
        if (this.status === WhatsappStatus.FAILED) {
            throw new UnprocessableEntityException(`The session under FAILED status. Please try to restart it.`);
        }
        return await this.whatsapp.pupPage.screenshot()
    }


    private async downloadAndDecryptMedia(message: Message) {
        if (!message.hasMedia) {
            return message
        }

        this.log.log(`The message ${message.id} has media, downloading it...`);
        return message.downloadMedia().then(async (media: MessageMedia) => {
            this.log.verbose(`Writing file from the message ${message.id}...`)
            const buffer = Buffer.from(media.data, "base64")
            const url = await this.storage.save(message.id, media.mimetype, buffer)
            this.log.log(`The file from ${message.id} has been saved to ${url}`);

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            message.mediaUrl = url
            return message
        })

    }


    /**
     * Get venom instance if it's working (with no QR code required)
     */
    public getWhatsapp() {
        if (this.status != WhatsappStatus.WORKING) {
            throw new UnprocessableEntityException(
                `The session status is "${this.status}". Please scan QR code first by using GET /screenshot method.`,
            );
        }
        return this.whatsapp

    }

    public subscribe(hook, handler) {
        if (hook === Hooks.ON_MESSAGE) {
            this.whatsapp.on(Events.MESSAGE_RECEIVED, (message) => this.processMessage(message).then(handler))
        } else if (hook === Hooks.ON_ANY_MESSAGE_HOOK) {
            this.whatsapp.on(Events.MESSAGE_CREATE, (message) => this.processMessage(message).then(handler))
        }
    }

    private processMessage(message: Message) {
        return this.downloadAndDecryptMedia(message)
    }
}

