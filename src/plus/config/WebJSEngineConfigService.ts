import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { WebJSConfig } from '../../core/engines/webjs/session.webjs.core';

@Injectable()
export class WebJSEngineConfigService {
  constructor(protected configService: ConfigService) {}

  getConfig(): WebJSConfig {
    let webVersion = this.configService.get(
      'WAHA_WEBJS_WEB_VERSION',
      undefined,
    );
    if (webVersion === '2.2412.54-videofix') {
      // Deprecated version
      webVersion = undefined;
    }
    return {
      webVersion: webVersion,
    };
  }
}
