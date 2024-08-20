import { Injectable } from '@nestjs/common';
import { WhatsappConfigService } from '@waha/config.service';
import { IMediaStorage } from '@waha/core/media/IMediaStorage';
import { MediaLocalStorage } from '@waha/plus/media/local/MediaLocalStorage';
import { MediaStorageFactory } from '@waha/plus/media/MediaStorageFactory';
import { Logger } from 'pino';

@Injectable()
export class MediaLocalStorageFactory extends MediaStorageFactory {
  constructor(private config: WhatsappConfigService) {
    super();
  }

  build(logger: Logger): IMediaStorage {
    return new MediaLocalStorage(
      logger,
      this.config.filesFolder,
      this.config.filesURL,
      this.config.filesLifetime,
    );
  }
}
