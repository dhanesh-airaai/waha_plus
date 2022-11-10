import request = require('requestretry');
import {WebhookConductorCore} from "../core/webhooks.core";
import {SECOND} from "../structures/enums.dto";

export class WebhookConductorPlus extends WebhookConductorCore {
    private RETRY_DELAY = 2
    private RETRY_ATTEMPTS = 15;

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
