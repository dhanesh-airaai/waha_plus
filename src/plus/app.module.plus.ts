import { ConsoleLogger, MiddlewareConsumer, Module } from '@nestjs/common';
import { DiskHealthIndicator, HealthCheckService } from '@nestjs/terminus';

import { WhatsappConfigService } from '../config.service';
import { SessionManager } from '../core/abc/manager.abc';
import { WAHAHealthCheckService } from '../core/abc/WAHAHealthCheckService';
import { CONTROLLERS, IMPORTS } from '../core/app.module.core';
import { ApiKeyStrategy } from './auth/apiKey.strategy';
import { AuthMiddleware } from './auth/auth.middleware';
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
export class AppModulePlus {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('api', 'health');
  }
}
