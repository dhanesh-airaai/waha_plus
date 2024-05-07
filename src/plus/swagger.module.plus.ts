import { INestApplication } from '@nestjs/common';

import { SwaggerModuleCore } from '../core/swagger.module.core';
import { BasicAuthFunction } from './auth/basicAuth';
import { DashboardConfigServicePlus } from './config/DashboardConfigServicePlus';
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
    const dashboardConfig = app.get(DashboardConfigServicePlus);
    const authFunction = BasicAuthFunction(username, password, [
      '/api/',
      dashboardConfig.dashboardUri,
      '/health',
    ]);
    app.use(authFunction);
  }
}
