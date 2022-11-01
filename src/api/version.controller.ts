import {Controller, Get} from '@nestjs/common';
import {ApiTags} from "@nestjs/swagger";
import {VERSION} from "../version";


@Controller('api/version')
@ApiTags('other')
export class VersionController {
    @Get('')
    async get() {
        return VERSION
    }
}

