import { ConsoleLogger, MiddlewareConsumer, Module } from '@nestjs/common';

import { WhatsappConfigService } from '../config.service';
import { SessionManager } from '../core/abc/manager.abc';
import { WAHAHealthCheckService } from '../core/abc/WAHAHealthCheckService';
import { AppModuleCore, CONTROLLERS, IMPORTS } from '../core/app.module.core';
import { ApiKeyStrategy } from './auth/apiKey.strategy';
import { AuthMiddleware } from './auth/auth.middleware';
import { BasicAuthFunction } from './auth/basicAuth';
import { CheckFreeDiskSpaceIndicator } from './health/CheckFreeDiskSpaceIndicator';
import { MongoStoreHealthIndicator } from './health/MongoStoreHealthIndicator';
import { WAHAHealthCheckServicePlus } from './health/WAHAHealthCheckServicePlus';
import { SessionManagerPlus } from './manager.plus';

const PROVIDERS = [
  {
    provide: SessionManager,
    inject: [WhatsappConfigService, ConsoleLogger],
    useFactory: async (config: WhatsappConfigService, log: ConsoleLogger) => {
      const manager = new SessionManagerPlus(config, log);
      await manager.init();
      return manager;
    },
  },
  {
    provide: WAHAHealthCheckService,
    useClass: WAHAHealthCheckServicePlus,
  },
  MongoStoreHealthIndicator,
  CheckFreeDiskSpaceIndicator,
  WhatsappConfigService,
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
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('api', 'health');
    const dashboardCredentials = this.config.getDashboardUsernamePassword();
    if (dashboardCredentials) {
      const username = dashboardCredentials[0];
      const password = dashboardCredentials[1];
      const route = WhatsappConfigService.noSlash(this.config.dashboardUri);
      consumer.apply(BasicAuthFunction(username, password)).forRoutes(route);
    }
  }
}
