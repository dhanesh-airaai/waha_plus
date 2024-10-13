import { VERSION } from '@waha/version';
import axios from 'axios';
import { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import * as crypto from 'crypto';
import { v4 as uuid4 } from 'uuid';

import { WebhookSender } from '../core/abc/webhooks.abc';
import { WebhookConductorCore, WebhookSenderCore } from '../core/webhooks.core';
import { SECOND } from '../structures/enums.dto';
import { WebhookConfig } from '../structures/webhooks.config.dto';

const DEFAULT_RETRY_DELAY_SECONDS = 2;
const DEFAULT_RETRY_ATTEMPTS = 15;
const DEFAULT_HMAC_ALGORITHM = 'sha512';

export class WebhookSenderPlus extends WebhookSenderCore {
  protected buildAxiosInstance(): AxiosInstance {
    // configure headers
    const customHeaders = this.config.customHeaders || [];
    const headers = {
      'content-type': 'application/json',
      'User-Agent': `WAHA/${VERSION.version}`,
    };
    customHeaders.forEach((header) => {
      headers[header.name] = header.value;
    });

    // configure retry
    const attempts = this.config.retries?.attempts ?? DEFAULT_RETRY_ATTEMPTS;
    const delaySeconds =
      this.config.retries?.delaySeconds ?? DEFAULT_RETRY_DELAY_SECONDS;
    const delayMs = delaySeconds * SECOND;

    const instance = axios.create({
      headers: headers,
      httpAgent: WebhookSenderCore.AGENTS.http,
      httpsAgent: WebhookSenderCore.AGENTS.https,
    });
    axiosRetry(instance, {
      retries: attempts,
      retryDelay: (_) => delayMs,
      retryCondition: (error) => true,
      onRetry: (retryCount, error, requestConfig) => {
        this.logger.warn(
          { id: requestConfig.headers['X-Webhook-Request-Id'] },
          `Error sending POST request: '${error.message}'. Retrying ${retryCount}/${attempts}...`,
        );
      },
    });
    return instance;
  }

  protected getHMACHeaders(body: string) {
    // HMAC
    const hmac = this.calculateHmac(body, DEFAULT_HMAC_ALGORITHM);
    if (!hmac) {
      return {};
    }
    return {
      'X-Webhook-Hmac': hmac,
      'X-Webhook-Hmac-Algorithm': DEFAULT_HMAC_ALGORITHM,
    };
  }

  protected getWebhookHeader() {
    return {
      // UUID, no '-' in it
      'X-Webhook-Request-Id': uuid4().replace(/-/g, ''),
      // unix timestamp with ms
      'X-Webhook-Timestamp': Date.now().toString(),
    };
  }

  private calculateHmac(body, algorithm) {
    if (!this.config.hmac || !this.config.hmac.key) {
      return undefined;
    }

    return crypto
      .createHmac(algorithm, this.config.hmac.key)
      .update(body)
      .digest('hex');
  }

  send(json: any) {
    const body = JSON.stringify(json);
    const headers = {};
    Object.assign(headers, this.getWebhookHeader());
    Object.assign(headers, this.getHMACHeaders(body));
    super.send(json, headers);
  }
}

export class WebhookConductorPlus extends WebhookConductorCore {
  protected buildSender(webhookConfig: WebhookConfig): WebhookSender {
    return new WebhookSenderPlus(this.loggerBuilder, webhookConfig);
  }
}
