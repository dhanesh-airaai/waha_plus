import {ConsoleLogger, Module} from '@nestjs/common';
import {ScreenshotController} from "./api/screenshot.controller";
import {ConfigModule} from "@nestjs/config";
import {WhatsappConfigService} from "./config.service";
import {ServeStaticModule} from "@nestjs/serve-static";
import {SessionsController} from "./api/sessions.controller";
import {ChattingController} from "./api/chatting.controller";
import {MultiSessionManager} from "./core/manager.multi";
import {VersionController} from "./api/version.controller";

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
    ],
    controllers: [
        SessionsController,
        ChattingController,
        ScreenshotController,
        VersionController,
    ],
    providers: [MultiSessionManager, ConsoleLogger, WhatsappConfigService],
})
export class AppModule {
}
