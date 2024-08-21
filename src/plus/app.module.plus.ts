import * as process from 'node:process';

import {
  ConsoleLogger,
  INestApplication,
  MiddlewareConsumer,
  Module,
} from '@nestjs/common';
import { ConditionalModule, ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MediaLocalStorageConfig } from '@waha/core/media/local/MediaLocalStorageConfig';
import { parseBool } from '@waha/helpers';
import { BufferJsonReplacerInterceptor } from '@waha/nestjs/BufferJsonReplacerInterceptor';
import { WebsocketGatewayPlus } from '@waha/plus/api/websocket.gateway.plus';
import { HttpsExpress } from '@waha/plus/HttpsExpress';
import { MediaLocalStorageModule } from '@waha/plus/media/local/media.local.storage.module';
import { MediaStorageFactory } from '@waha/plus/media/MediaStorageFactory';
import { MediaS3StorageModule } from '@waha/plus/media/s3/media.s3.storage.module';
import { isDebugEnabled } from '@waha/utils/logging';
import * as Joi from 'joi';
import { PinoLogger } from 'nestjs-pino';
import { Logger } from 'pino';

import { WhatsappConfigService } from '../config.service';
import { SessionManager } from '../core/abc/manager.abc';
import { WAHAHealthCheckService } from '../core/abc/WAHAHealthCheckService';
import { AppModuleCore, CONTROLLERS } from '../core/app.module.core';
import { IMPORTS as IMPORTS_CORE } from '../core/app.module.core';
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

const IMPORTS_MEDIA = [
  ConfigModule.forRoot({
    validationSchema: Joi.object({
      WAHA_MEDIA_STORAGE: Joi.string().valid('LOCAL', 'S3').default('LOCAL'),
    }),
  }),
  ConditionalModule.registerWhen(
    MediaLocalStorageModule,
    (env: NodeJS.ProcessEnv) =>
      !env['WAHA_MEDIA_STORAGE'] || env['WAHA_MEDIA_STORAGE'] == 'LOCAL',
    { debug: isDebugEnabled() },
  ),
  ConditionalModule.registerWhen(
    MediaS3StorageModule,
    (env: NodeJS.ProcessEnv) => env['WAHA_MEDIA_STORAGE'] == 'S3',
    { debug: isDebugEnabled() },
  ),
];

const IMPORTS = [...IMPORTS_CORE, ...IMPORTS_MEDIA];

const PROVIDERS = [
  {
    provide: SessionManager,
    inject: [
      WhatsappConfigService,
      EngineConfigService,
      WebJSEngineConfigService,
      PinoLogger,
      MediaStorageFactory,
    ],
    useFactory: async (
      config: WhatsappConfigService,
      engineConfigService: EngineConfigService,
      webJSEngineConfigService: WebJSEngineConfigService,
      logger: PinoLogger,
      mediaFactory: MediaStorageFactory,
    ) => {
      const manager = new SessionManagerPlus(
        config,
        engineConfigService,
        webJSEngineConfigService,
        logger,
        mediaFactory,
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
  {
    provide: APP_INTERCEPTOR,
    useClass: BufferJsonReplacerInterceptor,
  },
  SwaggerConfigServicePlus,
  MongoStoreHealthIndicator,
  CheckFreeDiskSpaceIndicator,
  WhatsappConfigService,
  EngineConfigService,
  WebJSEngineConfigService,
  ApiKeyStrategy,
  WebsocketGatewayPlus,
  MediaLocalStorageConfig,
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
    const exclude = this.config.getExcludedPaths();
    consumer
      .apply(AuthMiddleware)
      .exclude(...exclude)
      .forRoutes('api', 'health', 'ws');
    const dashboardCredentials = this.dashboardConfig.credentials;
    if (dashboardCredentials) {
      const username = dashboardCredentials[0];
      const password = dashboardCredentials[1];
      const route = noSlashAtTheEnd(this.dashboardConfig.dashboardUri);
      consumer.apply(BasicAuthFunction(username, password)).forRoutes(route);
    }
  }

  static getHttpsOptions(logger: Logger) {
    const httpsEnabled = parseBool(process.env.WAHA_HTTPS_ENABLED);
    if (!httpsEnabled) {
      return undefined;
    }
    const httpsExpress = new HttpsExpress(logger);
    return httpsExpress.readSync();
  }

  static appReady(app: INestApplication, logger: Logger) {
    const httpsEnabled = parseBool(process.env.WAHA_HTTPS_ENABLED);
    if (!httpsEnabled) {
      return;
    }
    const httpd = app.getHttpServer();
    const httpsExpress = new HttpsExpress(logger);
    httpsExpress.watchCertChanges(httpd);
  }
}
