import { SwaggerConfiguratorCore } from '../core/SwaggerConfiguratorCore';
import { BasicAuthFunction } from './auth/basicAuth';
import { DashboardConfigServicePlus } from './config/DashboardConfigServicePlus';
import { SwaggerConfigServicePlus } from './config/SwaggerConfigServicePlus';

export class SwaggerConfiguratorPlus extends SwaggerConfiguratorCore {
  configure(webhooks: any[]) {
    const swaggerConfig = this.app.get(SwaggerConfigServicePlus);
    if (!swaggerConfig.enabled) {
      console.log('Swagger is disabled.');
      return;
    }

    const credentials = swaggerConfig.credentials;
    if (credentials) {
      this.setUpAuth(credentials);
    }
    super.configure(webhooks);
  }

  setUpAuth(credentials: [string, string]): void {
    const [username, password] = credentials;
    const dashboardConfig = this.app.get(DashboardConfigServicePlus);
    const authFunction = BasicAuthFunction(username, password, [
      '/api/',
      dashboardConfig.dashboardUri,
      '/health',
    ]);
    this.app.use(authFunction);
  }
}
