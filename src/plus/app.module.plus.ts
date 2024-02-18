import { ConsoleLogger, MiddlewareConsumer, Module } from '@nestjs/common';

import { WhatsappConfigService } from '../config.service';
import { SessionManager } from '../core/abc/manager.abc';
import { CONTROLLERS, IMPORTS } from '../core/app.module.core';
import { ApiKeyStrategy } from './auth/apiKey.strategy';
import { AuthMiddleware } from './auth/auth.middleware';
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
  WhatsappConfigService,
  ConsoleLogger,
  ApiKeyStrategy,
];

@Module({
  imports: IMPORTS,
  controllers: CONTROLLERS,
  providers: PROVIDERS,
})
export class AppModulePlus {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('');
  }
}
