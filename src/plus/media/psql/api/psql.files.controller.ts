import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MediaPsqlStorage } from '@waha/plus/media/psql/MediaPsqlStorage';
import { MediaPsqlStorageFactory } from '@waha/plus/media/psql/MediaPsqlStorageFactory';
import { PsqlCode } from '@waha/plus/storage/psql/PsqlCode';
import { PinoLogger } from 'nestjs-pino';
import * as NodeCache from 'node-cache';

@Controller('api/files')
@ApiTags('🗄️ Storage')
export class PsqlFilesController {
  storages: NodeCache;

  constructor(
    private factory: MediaPsqlStorageFactory,
    private logger: PinoLogger,
  ) {
    this.storages = new NodeCache({
      stdTTL: 60, // 1 minute
      useClones: false,
    });
    this.storages.on('del', async (key, value) => {
      await value.close();
    });
  }

  private async getStorage(session: string): Promise<MediaPsqlStorage> {
    if (!this.storages.has(session)) {
      const logger = this.logger.logger.child({ session: session });
      const storage = await this.factory.build(session, logger, false);
      this.storages.set(session, storage);
    }
    // Increase TTL back
    this.storages.ttl(session);
    return this.storages.get(session);
  }

  @Get(':session/*')
  @ApiOperation({
    summary: 'Get file',
  })
  async get(
    @Param('session') session: string,
    @Param('0') filepath: string,
  ): Promise<StreamableFile> {
    const storage = await this.getStorage(session);
    let data;
    try {
      data = await storage.fetch(filepath);
    } catch (err) {
      if (
        err.code === PsqlCode.DATABASE_NOT_EXIST ||
        err.code === PsqlCode.RELATION_NOT_FOUND
      ) {
        throw new NotFoundException(
          `Session database or table not found: ${session}`,
        );
      }
      throw err;
    }

    if (!data) {
      throw new NotFoundException(`File not found: ${filepath}`);
    }

    const filename = this.getFilename(filepath);
    return new StreamableFile(data.content, {
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Delete(':session/*')
  @ApiOperation({
    summary: 'Delete file',
  })
  async delete(
    @Param('session') session: string,
    @Param('0') filepath: string,
  ) {
    const storage = await this.getStorage(session);
    try {
      await storage.remove(filepath);
    } catch (err) {
      if (
        err.code === PsqlCode.DATABASE_NOT_EXIST ||
        err.code === PsqlCode.RELATION_NOT_FOUND
      ) {
        return;
      }
      throw err;
    }
  }

  private getFilename(filepath: string) {
    return filepath.split('/').pop();
  }
}
