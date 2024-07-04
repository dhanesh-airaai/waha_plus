import * as fs from 'node:fs';
import * as process from 'node:process';

import {
  ConsoleLogger,
  INestApplication,
  MiddlewareConsumer,
  Module,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { BufferJsonReplacerInterceptor } from '@waha/api/BufferJsonReplacerInterceptor';
import { WebsocketGatewayCore } from '@waha/core/api/websocket.gateway.core';
import { parseBool } from '@waha/helpers';
import { WebsocketGatewayPlus } from '@waha/plus/api/websocket.gateway.plus';
import { HttpsExpress } from '@waha/plus/HttpsExpress';

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
      EngineConfigService,
      WebJSEngineConfigService,
    ],
    useFactory: async (
      config: WhatsappConfigService,
      engineConfigService: EngineConfigService,
      webJSEngineConfigService: WebJSEngineConfigService,
    ) => {
      const manager = new SessionManagerPlus(
        config,
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
  ConsoleLogger,
  ApiKeyStrategy,
  WebsocketGatewayPlus,
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
    consumer.apply(AuthMiddleware).forRoutes('api', 'health', 'ws');
    const dashboardCredentials = this.dashboardConfig.credentials;
    if (dashboardCredentials) {
      const username = dashboardCredentials[0];
      const password = dashboardCredentials[1];
      const route = noSlashAtTheEnd(this.dashboardConfig.dashboardUri);
      consumer.apply(BasicAuthFunction(username, password)).forRoutes(route);
    }
  }

  static getHttpsOptions() {
    const httpsEnabled = parseBool(process.env.WAHA_HTTPS_ENABLED);
    if (!httpsEnabled) {
      return undefined;
    }
    const httpsExpress = new HttpsExpress();
    return httpsExpress.readSync();
  }

  static appReady(app: INestApplication) {
    const httpsEnabled = parseBool(process.env.WAHA_HTTPS_ENABLED);
    if (!httpsEnabled) {
      return;
    }
    const httpd = app.getHttpServer();
    const httpsExpress = new HttpsExpress();
    httpsExpress.watchCertChanges(httpd);
  }
}
