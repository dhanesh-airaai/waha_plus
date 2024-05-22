import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { WebJSConfig } from '../../core/engines/webjs/session.webjs.core';

@Injectable()
export class WebJSEngineConfigService {
  constructor(protected configService: ConfigService) {}

  getConfig(): WebJSConfig {
    return {
      webVersion: this.configService.get('WAHA_WEBJS_WEB_VERSION', undefined),
    };
  }
}
