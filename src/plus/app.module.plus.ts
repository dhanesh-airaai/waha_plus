import { ConsoleLogger, MiddlewareConsumer, Module } from '@nestjs/common';

import { WhatsappConfigService } from '../config.service';
import { SessionManager } from '../core/abc/manager.abc';
import { WAHAHealthCheckService } from '../core/abc/WAHAHealthCheckService';
import { AppModuleCore, CONTROLLERS, IMPORTS } from '../core/app.module.core';
import { DashboardConfigServiceCore } from '../core/config/DashboardConfigServiceCore';
import { EngineConfigService } from '../core/config/EngineConfigService';
import { SwaggerConfigServiceCore } from '../core/config/SwaggerConfigServiceCore';
import { noSlashAtTheEnd } from '../utils/string';
import { ApiKeyStrategy } from './auth/apiKey.strategy';
import { AuthMiddleware } from './auth/auth.middleware';
import { BasicAuthFunction } from './auth/basicAuth';
import { DashboardConfigServicePlus } from './config/DashboardConfigServicePlus';
import { SwaggerConfigServicePlus } from './config/SwaggerConfigServicePlus';
import { WebJSEngineConfigService } from './config/WebJSEngineConfigService';
import { CheckFreeDiskSpaceIndicator } from './health/CheckFreeDiskSpaceIndicator';
import { MongoStoreHealthIndicator } from './health/MongoStoreHealthIndicator';
import { WAHAHealthCheckServicePlus } from './health/WAHAHealthCheckServicePlus';
import { SessionManagerPlus } from './manager.plus';

const PROVIDERS = [
  {
    provide: SessionManager,
    inject: [
      WhatsappConfigService,
      ConsoleLogger,
      EngineConfigService,
      WebJSEngineConfigService,
    ],
    useFactory: async (
      config: WhatsappConfigService,
      log: ConsoleLogger,
      engineConfigService: EngineConfigService,
      webJSEngineConfigService: WebJSEngineConfigService,
    ) => {
      const manager = new SessionManagerPlus(
        config,
        log,
        engineConfigService,
        webJSEngineConfigService,
      );
      await manager.init();
      return manager;
    },
  },
  {
    provide: WAHAHealthCheckService,
    useClass: WAHAHealthCheckServicePlus,
  },
  {
    provide: SwaggerConfigServiceCore,
    useClass: SwaggerConfigServicePlus,
  },
  {
    provide: SwaggerConfigServicePlus,
    useClass: SwaggerConfigServicePlus,
  },
  {
    provide: DashboardConfigServiceCore,
    useClass: DashboardConfigServicePlus,
  },
  {
    provide: DashboardConfigServicePlus,
    useClass: DashboardConfigServicePlus,
  },
  SwaggerConfigServicePlus,
  MongoStoreHealthIndicator,
  CheckFreeDiskSpaceIndicator,
  WhatsappConfigService,
  EngineConfigService,
  WebJSEngineConfigService,
  ConsoleLogger,
  ApiKeyStrategy,
];

@Module({
  imports: IMPORTS,
  controllers: CONTROLLERS,
  // @ts-ignore
  providers: PROVIDERS,
})
export class AppModulePlus extends AppModuleCore {
  constructor(
    protected config: WhatsappConfigService,
    private dashboardConfig: DashboardConfigServicePlus,
  ) {
    super(config);
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('api', 'health');
    const dashboardCredentials = this.dashboardConfig.credentials;
    if (dashboardCredentials) {
      const username = dashboardCredentials[0];
      const password = dashboardCredentials[1];
      const route = noSlashAtTheEnd(this.dashboardConfig.dashboardUri);
      consumer.apply(BasicAuthFunction(username, password)).forRoutes(route);
    }
  }
}
