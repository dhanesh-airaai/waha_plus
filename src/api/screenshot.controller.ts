import {Controller, Get, Query, Res} from '@nestjs/common';
import {ApiSecurity, ApiTags} from "@nestjs/swagger";
import {Readable} from "stream";
import {Response} from 'express';
import {MultiSessionManager} from "../core/manager.multi";
import {SessionQuery} from "../structures/chatting.dto";


@ApiSecurity('api_key')
@Controller('api')
@ApiTags('screenshot')
export class ScreenshotController {
    constructor(private whatsappSessionManager: MultiSessionManager) {
    }

    @Get('/screenshot')
    async screenshot(
        @Res() res: Response,
        @Query() sessionQuery: SessionQuery,
    ) {
        const whatsappService = this.whatsappSessionManager.getSession(sessionQuery.sessionName)
        const buffer = await whatsappService.getScreenshot();
        const stream = new Readable();
        stream.push(buffer);
        stream.push(null);

        res.set({
            'Content-Type': 'image/png',
            'Content-Length': buffer.length,
        });
        stream.pipe(res)
    }
}

