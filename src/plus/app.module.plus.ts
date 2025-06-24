import { Module } from '@nestjs/common';
import { ConditionalModule, ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { WebsocketGatewayCore } from '@waha/core/api/websocket.gateway.core';
import { ApiKeyStrategy } from '@waha/core/auth/apiKey.strategy';
import { WebSocketAuth } from '@waha/core/auth/WebSocketAuth';
import { GowsEngineConfigService } from '@waha/core/config/GowsEngineConfigService';
import { WebJSEngineConfigService } from '@waha/core/config/WebJSEngineConfigService';
import { MediaLocalStorageModule } from '@waha/core/media/local/media.local.storage.module';
import { MediaLocalStorageConfig } from '@waha/core/media/local/MediaLocalStorageConfig';
import { ChannelsInfoServiceCore } from '@waha/core/services/ChannelsInfoServiceCore';
import { BufferJsonReplacerInterceptor } from '@waha/nestjs/BufferJsonReplacerInterceptor';
import { MediaPsqlStorageModule } from '@waha/plus/media/psql/media.psql.storage.module';
import { MediaS3StorageModule } from '@waha/plus/media/s3/media.s3.storage.module';
import { ChannelsInfoServicePlus } from '@waha/plus/services/ChannelsInfoServicePlus';
import { isDebugEnabled } from '@waha/utils/logging';
import * as Joi from 'joi';

import { WhatsappConfigService } from '../config.service';
import { SessionManager } from '../core/abc/manager.abc';
import { WAHAHealthCheckService } from '../core/abc/WAHAHealthCheckService';
import {
  AppModuleCore,
  CONTROLLERS,
  IMPORTS_CORE,
} from '../core/app.module.core';
import { DashboardConfigServiceCore } from '../core/config/DashboardConfigServiceCore';
import { EngineConfigService } from '../core/config/EngineConfigService';
import { SwaggerConfigServiceCore } from '../core/config/SwaggerConfigServiceCore';
import { CheckFreeDiskSpaceIndicator } from './health/CheckFreeDiskSpaceIndicator';
import { MongoStoreHealthIndicator } from './health/MongoStoreHealthIndicator';
import { WAHAHealthCheckServicePlus } from './health/WAHAHealthCheckServicePlus';
import { SessionManagerPlus } from './manager.plus';

const IMPORTS_MEDIA = [
  ConfigModule.forRoot({
    validationSchema: Joi.object({
      WAHA_MEDIA_STORAGE: Joi.string()
        .valid('LOCAL', 'S3', 'POSTGRESQL')
        .default('LOCAL'),
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
  ConditionalModule.registerWhen(
    MediaPsqlStorageModule,
    (env: NodeJS.ProcessEnv) => env['WAHA_MEDIA_STORAGE'] == 'POSTGRESQL',
    { debug: isDebugEnabled() },
  ),
];

const IMPORTS = [...IMPORTS_CORE, ...IMPORTS_MEDIA];

const PROVIDERS = [
  {
    provide: SessionManager,
    useClass: SessionManagerPlus,
  },
  {
    provide: WAHAHealthCheckService,
    useClass: WAHAHealthCheckServicePlus,
  },
  {
    provide: ChannelsInfoServiceCore,
    useClass: ChannelsInfoServicePlus,
  },
  {
    provide: APP_INTERCEPTOR,
    useClass: BufferJsonReplacerInterceptor,
  },
  SwaggerConfigServiceCore,
  DashboardConfigServiceCore,
  MongoStoreHealthIndicator,
  CheckFreeDiskSpaceIndicator,
  WhatsappConfigService,
  EngineConfigService,
  WebJSEngineConfigService,
  GowsEngineConfigService,
  ApiKeyStrategy,
  WebsocketGatewayCore,
  MediaLocalStorageConfig,
  WebSocketAuth,
];

@Module({
  imports: IMPORTS,
  controllers: CONTROLLERS,
  // @ts-ignore
  providers: PROVIDERS,
})
export class AppModulePlus extends AppModuleCore {}
