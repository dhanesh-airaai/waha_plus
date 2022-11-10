import request = require('requestretry');
import {WhatsappSession} from "./abc/session.abc";
import {ConsoleLogger} from "@nestjs/common";
import {SECOND, WAEvents} from "../structures/enums.dto";
import {WAWebhook} from "../structures/responses.dto";
import {NotImplementedByEngineError} from "./exceptions";
import {WebhookConductorBase} from "./abc/webhooks.abc";


export class WebhookConductor implements WebhookConductorBase {
    private RETRY_DELAY = 15
    private RETRY_ATTEMPTS = 3;

    constructor(protected log: ConsoleLogger, private readonly url, private readonly events: WAEvents[] | string[]) {
        this.url = url
        this.events = this.getSuitableEvents(events)
        this.log = log
    }

    private getSuitableEvents(events: WAEvents[] | string[]) {
        const allEvents = Object.values(WAEvents)

        // Enable all events if * in the events
        // @ts-ignore
        if (events.includes("*")) {
            return allEvents
        }

        // Get only known events, log and ignore others
        const rightEvents = []
        for (const event of events) {
            // @ts-ignore
            if (!allEvents.includes(event)) {
                this.log.error(`Unknown event for webhook: '${event}'`)
                continue
            }
            rightEvents.push(event)
        }
        return rightEvents
    }

    public configure(session: WhatsappSession) {
        this.log.log('Configuring webhooks...')
        for (const event of this.events) {
            try {
                session.subscribe(event, (data: any) => this.callWebhook(event, data, this.url))
            } catch (error) {
                if (error instanceof NotImplementedByEngineError) {
                    this.log.error(error)
                } else {
                    throw error
                }
            }
            this.log.log(`Event '${event}' is enabled for url: ${this.url}`)
        }
        this.log.log('Webhooks were configured.')
    }

    public callWebhook(event, data: any, url) {
        const json: WAWebhook = {event: event, payload: data}
        this.log.log(`Sending POST to ${url}...`)
        this.log.debug(`POST DATA: ${JSON.stringify(json)}`)
        this.post(json, url)
    }

    protected post(json, url) {
        request.post(
            url,
            {
                json: json,
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
