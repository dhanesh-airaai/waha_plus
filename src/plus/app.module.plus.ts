import {ConsoleLogger, MiddlewareConsumer, Module} from '@nestjs/common';
import {WhatsappConfigService} from "../config.service";
import {AuthMiddleware} from "./auth/auth.middleware";
import {SessionManager} from "../core/abc/manager.abc";
import {SessionManagerPlus} from "./manager.plus";
import {CONTROLLERS, IMPORTS} from "../core/app.module.core";
import {ApiKeyStrategy} from "./auth/apiKey.strategy";

const PROVIDERS = [
    {
        provide: SessionManager,
        useClass: SessionManagerPlus,
    },
    WhatsappConfigService,
    ConsoleLogger,
    ApiKeyStrategy,
]

@Module({
    imports: IMPORTS,
    controllers: CONTROLLERS,
    providers: PROVIDERS,
})
export class AppModulePlus {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(AuthMiddleware).forRoutes("");
    }
}
