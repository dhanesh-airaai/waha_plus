import { INestApplication } from '@nestjs/common';

import { WhatsappConfigService } from '../config.service';
import { SwaggerModuleCore } from '../core/swagger.module.core';
import { BasicAuthFunction } from './auth/basicAuth';
import { SwaggerConfigServicePlus } from './config/SwaggerConfigServicePlus';

export class SwaggerModulePlus extends SwaggerModuleCore {
  configure(app: INestApplication, webhooks: any[]) {
    const swaggerConfig = app.get(SwaggerConfigServicePlus);
    if (!swaggerConfig.enabled) {
      console.log('Swagger is disabled.');
      return;
    }

    const credentials = swaggerConfig.credentials;
    if (credentials) {
      this.setUpAuth(app, credentials);
    }
    super.configure(app, webhooks);
  }

  setUpAuth(app: INestApplication, credentials: [string, string]): void {
    const [username, password] = credentials;
    const config = app.get(WhatsappConfigService);
    const authFunction = BasicAuthFunction(username, password, [
      '/api/',
      config.dashboardUri,
      '/health',
    ]);
    app.use(authFunction);
  }
}
