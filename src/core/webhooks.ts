import request = require('requestretry');
import {WhatsappConfigService} from "../config.service";
import {WhatsappSession} from "./session";
import {ConsoleLogger} from "@nestjs/common";
import {Hooks, SECOND} from "./enums";


export class WebhookConductor {
    private log: ConsoleLogger;
    private RETRY_DELAY = 15
    private RETRY_ATTEMPTS = 3;
    ENV_PREFIX = "WHATSAPP_HOOK_"

    constructor(private config: WhatsappConfigService,) {
        this.config = config
        this.log = new ConsoleLogger()
    }

    public configure(session: WhatsappSession) {
        this.log.log('Configuring webhooks...')
        for (const [name, value] of Object.entries(Hooks)) {
            const env_name = this.ENV_PREFIX + value
            const url = this.config.get(env_name)
            if (!url) {
                this.log.log(`Hook '${name}' is disabled. Set ${env_name} environment variable to url if you want to enabled it.`)
                continue
            }
            session.subscribe(value, (message) => this.callWebhook(message, url))
            this.log.log(`Hook '${name}' was enabled to url: ${url}`)
        }
        this.log.log('Webhooks were configured.')
    }

    public callWebhook(data: any, url) {
        this.log.log(`Sending POST to ${url}...`)
        this.log.debug(`POST DATA: ${JSON.stringify(data)}`)

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
}
