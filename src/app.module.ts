import {ConsoleLogger, MiddlewareConsumer, Module} from '@nestjs/common';
import {ScreenshotController} from "./api/screenshot.controller";
import {ConfigModule} from "@nestjs/config";
import {WhatsappConfigService} from "./config.service";
import {ServeStaticModule} from "@nestjs/serve-static";
import {SessionsController} from "./api/sessions.controller";
import {ChattingController} from "./api/chatting.controller";
import {VersionController} from "./api/version.controller";
import {PassportModule} from "@nestjs/passport";
import {ApiKeyStrategy} from "./plus/auth/apiKey.strategy";
import {AuthMiddleware} from "./plus/auth/auth.middleware";
import {SessionManager} from "./core/abc/manager.abc";
import {SessionManagerPlus} from "./plus/manager.plus";


@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        ServeStaticModule.forRootAsync({
            imports: [],
            extraProviders: [WhatsappConfigService],
            inject: [WhatsappConfigService],
            useFactory: (config: WhatsappConfigService) => {
                return [{
                    rootPath: config.filesFolder,
                    serveRoot: config.files_uri,
                }]
            },
        }),
        PassportModule,
    ],
    controllers: [
        SessionsController,
        ChattingController,
        ScreenshotController,
        VersionController,
    ],
    providers: [
        {
            provide: SessionManager,
            useClass: SessionManagerPlus,
        },
        SessionManagerPlus,
        WhatsappConfigService,
        ApiKeyStrategy,
        ConsoleLogger,
    ],
})
export class AppModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(AuthMiddleware).forRoutes("");
    }
}
