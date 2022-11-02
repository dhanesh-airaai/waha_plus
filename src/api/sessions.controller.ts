import {Body, Controller, Get, Post} from '@nestjs/common';
import {ApiTags} from "@nestjs/swagger";
import {WhatsappSessionManager} from "../core/manager";
import {SessionDTO, SessionStartRequest, SessionStopRequest} from "../structures/sessions.dto";


@Controller('api/sessions')
@ApiTags('sessions')
export class SessionsController {
    constructor(private whatsappSessionManager: WhatsappSessionManager) {
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

