import {ConsoleLogger} from "@nestjs/common";
import {WhatsappConfigService} from "../config.service";
import {UnprocessableEntityException} from "@nestjs/common/exceptions/unprocessable-entity.exception";
import {Client, Events, LocalAuth, Message} from "whatsapp-web.js";
import {Hooks, WhatsappStatus} from "./enums";
import fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcode = require('qrcode-terminal');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {promisify} = require('util')
const writeFileAsync = promisify(fs.writeFile)


const SECOND = 1000;

export class WhatsappSession {
    public status: WhatsappStatus;
    private qrCodeBase64: string;
    readonly filesFolder: string
    readonly mimetypes: string[] | null
    readonly filesLifetime: number
    private log: ConsoleLogger;
    public whatsapp: Client;

    constructor(
        private config: WhatsappConfigService,
        public name: string,
    ) {
        this.name = name
        this.status = WhatsappStatus.STARTING
        this.log = new ConsoleLogger()
        this.log.setContext(`WhatsappService - ${this.name}`)
        this.filesFolder = this.config.filesFolder
        this.mimetypes = this.config.mimetypes
        this.filesLifetime = this.config.filesLifetime * SECOND
    }

    async start() {
        this.whatsapp = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {headless: true}
        });

        this.whatsapp.initialize().catch(error => {
            this.status = WhatsappStatus.FAILED
            this.log.error(error)
            // this.saveQRCode("")
            return
        });

        // Connect events
        this.whatsapp.on(Events.QR_RECEIVED, (qr) => {
            // NOTE: This event will not be fired if a session is specified.
            qrcode.generate(qr, {small: true});
            this.status = WhatsappStatus.SCAN_QR_CODE
        });

        this.whatsapp.on(Events.AUTHENTICATED, () => {
            this.status = WhatsappStatus.WORKING
            // this.saveQRCode("")
        });
    }

    public async getScreenshot(): Promise<Buffer | string> {
        if (this.status === WhatsappStatus.FAILED) {
            throw new UnprocessableEntityException(`The session under FAILED status. Please try to restart it.`);
        }
        return await this.whatsapp.pupPage.screenshot()
    }


    private async downloadAndDecryptMedia(message: Message) {
        return message
        // return this.whatsapp.decryptFile(message).then(async (buffer) => {
        //     // Download only certain mimetypes
        //     if (this.mimetypes !== null && !this.mimetypes.some((type) => message.mimetype.startsWith(type))) {
        //         this.log.log(`The message ${message.id} has ${message.mimetype} media, skip it.`);
        //         message.clientUrl = ""
        //         return message
        //     }
        //
        //     this.log.log(`The message ${message.id} has media, downloading it...`);
        //     const fileName = `${message.id}.${mime.extension(message.mimetype)}`;
        //     const filePath = path.resolve(`${this.filesFolder}/${fileName}`)
        //     this.log.verbose(`Writing file to ${filePath}...`)
        //     await writeFileAsync(filePath, buffer);
        //     this.log.log(`The file from ${message.id} has been saved to ${filePath}`);
        //
        //     message.clientUrl = this.config.filesURL + fileName
        //     this.removeFile(filePath)
        //     return message
        // });
    }

    private removeFile(file: string) {
        setTimeout(() => fs.unlink(file, () => {
            this.log.log(`File ${file} was removed`)
        }), this.filesLifetime)
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

    private saveQRCode(base64Qrimg) {
        base64Qrimg = base64Qrimg.replace(/^data:image\/png;base64,/, '');
        this.qrCodeBase64 = base64Qrimg
    }

    private getQRCode() {
        return Buffer.from(this.qrCodeBase64, "base64")
    }

    public subscribe(hook, handler) {
        if (hook === Hooks.ON_MESSAGE) {
            this.whatsapp.on(Events.MESSAGE_RECEIVED, (message) => this.downloadAndDecryptMedia(message).then(handler))
        } else if (hook === Hooks.ON_ANY_MESSAGE_HOOK) {
            this.whatsapp.on(Events.MESSAGE_CREATE, (message) => this.downloadAndDecryptMedia(message).then(handler))
        }
    }

}

