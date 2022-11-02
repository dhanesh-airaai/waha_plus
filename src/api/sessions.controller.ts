import {Body, Controller, Get, Post} from '@nestjs/common';
import {ApiSecurity, ApiTags} from "@nestjs/swagger";
import {MultiSessionManager} from "../core/manager.multi";
import {SessionDTO, SessionStartRequest, SessionStopRequest} from "../structures/sessions.dto";


@ApiSecurity('api_key')
@Controller('api/sessions')
@ApiTags('sessions')
export class SessionsController {
    constructor(private whatsappSessionManager: MultiSessionManager) {
    }


    @Post('/start/')
    start(@Body() request: SessionStartRequest): SessionDTO {
        return this.whatsappSessionManager.start(request)
    }

    @Post('/stop/')
    stop(@Body() request: SessionStopRequest): Promise<void> {
        return this.whatsappSessionManager.stop(request)
    }

    @Get('/')
    list(): SessionDTO[] {
        return this.whatsappSessionManager.getSessions()
    }
}

