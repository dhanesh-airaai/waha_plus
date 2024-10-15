import { VERSION } from '@waha/version';
import axios, { AxiosInstance } from 'axios';
import axiosRetry, { retryAfter } from 'axios-retry';
import * as crypto from 'crypto';
import { v4 as uuid4 } from 'uuid';

import { WebhookSender } from '../core/abc/webhooks.abc';
import { WebhookConductorCore, WebhookSenderCore } from '../core/webhooks.core';
import { SECOND } from '../structures/enums.dto';
import { RetryPolicy, WebhookConfig } from '../structures/webhooks.config.dto';

const DEFAULT_RETRY_DELAY_SECONDS = 2;
const DEFAULT_RETRY_ATTEMPTS = 15;
const DEFAULT_HMAC_ALGORITHM = 'sha512';

function noDelay(_retryNumber = 0, error: any) {
  return Math.max(0, retryAfter(error));
}

function constantDelay(delayFactor: number) {
  return (_retryNumber = 0, error = undefined) => {
    return Math.max(delayFactor, retryAfter(error));
  };
}

export function exponentialDelay(delayFactor: number) {
  return (retryNumber = 0, error = undefined) => {
    const calculatedDelay = 2 ** retryNumber * delayFactor;
    const delay = Math.max(calculatedDelay, retryAfter(error));
    const randomSum = delay * 0.2 * Math.random(); // 0-20% of the delay
    return delay + randomSum;
  };
}

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
    const policy = this.config.retries?.policy;
    const retryDelay = this.buildRetryDelay(policy, delayMs);

    const instance = axios.create({
      headers: headers,
      httpAgent: WebhookSenderCore.AGENTS.http,
      httpsAgent: WebhookSenderCore.AGENTS.https,
    });
    axiosRetry(instance, {
      retries: attempts,
      retryDelay: retryDelay,
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

  private buildRetryDelay(
    policy: RetryPolicy | null,
    ms: number,
  ): (retryNumber: number, error: any) => number {
    if (!ms) {
      this.logger.debug(`Using no delay, because delaySeconds set to 0`);
      return noDelay;
    }

    switch (policy) {
      case RetryPolicy.CONSTANT:
        this.logger.debug(`Using constant delay with '${ms}' ms factor`);
        return constantDelay(ms);

      case RetryPolicy.LINEAR:
        this.logger.debug(`Using linear delay with '${ms}' ms factor`);
        return axiosRetry.linearDelay(ms);

      case RetryPolicy.EXPONENTIAL:
        this.logger.debug(`Using exponential delay with '${ms}' ms factor`);
        return exponentialDelay(ms);

      default:
        this.logger.debug('No delay policy specified, using constant delay');
        return constantDelay(ms);
    }
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
