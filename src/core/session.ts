import {Message} from "venom-bot";
import {ConsoleLogger} from "@nestjs/common";
import {WhatsappConfigService} from "../config.service";
import {UnprocessableEntityException} from "@nestjs/common/exceptions/unprocessable-entity.exception";
import {Client, LocalAuth} from "whatsapp-web.js";
import request = require('requestretry');
import fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const qrcode = require('qrcode-terminal');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {promisify} = require('util')
const writeFileAsync = promisify(fs.writeFile)


const SECOND = 1000;

const ON_ANY_MESSAGE_HOOK = "onAnyMessage"
const ON_MESSAGE_HOOK = "onMessage"
const HOOKS = [
    ON_ANY_MESSAGE_HOOK,
    ON_MESSAGE_HOOK,
    "onStateChange",
    "onAck",
    // TODO: IMPLEMENTED THESE TOO
    // "onLiveLocation",
    // "onParticipantsChanged",
    "onAddedToGroup"
]
const ENV_PREFIX = "WHATSAPP_HOOK_"

export enum WhatsappStatus {
    STARTING = "STARTING",
    SCAN_QR_CODE = "SCAN_QR_CODE",
    WORKING = "WORKING",
    FAILED = "FAILED",
}

export class WhatsappSession {
    public status: WhatsappStatus;
    private qrCodeBase64: string;
    readonly filesFolder: string
    readonly mimetypes: string[] | null
    readonly filesLifetime: number
    private RETRY_DELAY = 15
    private RETRY_ATTEMPTS = 3;
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
        this.whatsapp.on('qr', (qr) => {
            // NOTE: This event will not be fired if a session is specified.
            qrcode.generate(qr, {small: true});
            this.status = WhatsappStatus.SCAN_QR_CODE
        });

        this.whatsapp.on('authenticated', () => {
            this.status = WhatsappStatus.WORKING
            // this.configureWebhooks();
            // this.saveQRCode("")
        });

    }

    public async getScreenshotOrQRCode(): Promise<Buffer | string> {
        if (this.status === WhatsappStatus.STARTING) {
            throw new UnprocessableEntityException(`The session is starting, please try again after few seconds`);
        } else if (this.status === WhatsappStatus.SCAN_QR_CODE) {
            return this.getQRCode()
        } else if (this.status === WhatsappStatus.WORKING) {
            return
            // return await this.whatsapp.page.screenshot()
        } else {
            throw new UnprocessableEntityException(`Unknown status - ${this.status}`);
        }
    }

    private callWebhook(data, url) {
        this.log.log(`Sending POST to ${url}...`)
        this.log.debug(`POST DATA: ${JSON.stringify(data)}`)

        // TODO: Use HttpModule with retry
        request.post(
            url,
            {
                json: data,
                maxAttempts: this.RETRY_ATTEMPTS,
                retryDelay: this.RETRY_DELAY * SECOND,
                retryStrategy: request.RetryStrategies.HTTPOrNetworkError
            },
            (error, res, body) => {
                if (error) {
                    this.log.error(error)
                    return
                }
                this.log.log(`POST request was sent with status code: ${res.statusCode}`)
                this.log.verbose(`Response: ${JSON.stringify(body)}`)
            })
    }

    private async onMessageHook(message: Message, url: string) {
        if (message.isMMS || message.isMedia) {
            this.downloadAndDecryptMedia(message).then(
                (data) => this.callWebhook(data, url)
            );
        } else {
            this.callWebhook(message, url);
        }
    }

    private async downloadAndDecryptMedia(message: Message) {
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

    private configureWebhooks() {
        this.log.log('Configuring webhooks...')
        for (const hook of HOOKS) {
            const env_name = ENV_PREFIX + hook.toUpperCase()
            const url = this.config.get(env_name)
            if (!url) {
                this.log.log(`Hook '${hook}' is disabled. Set ${env_name} environment variable to url if you want to enabled it.`)
                continue
            }

            if (hook === ON_MESSAGE_HOOK || hook == ON_ANY_MESSAGE_HOOK) {
                this.whatsapp[hook](data => this.onMessageHook(data, url))
            } else {
                this.whatsapp[hook](data => this.callWebhook(data, url))
            }
            this.log.log(`Hook '${hook}' was enabled to url: ${url}`)
        }
        this.log.log('Webhooks were configured.')
    }

    private saveQRCode(base64Qrimg) {
        base64Qrimg = base64Qrimg.replace(/^data:image\/png;base64,/, '');
        this.qrCodeBase64 = base64Qrimg
    }

    private getQRCode() {
        return Buffer.from(this.qrCodeBase64, "base64")
    }
}

