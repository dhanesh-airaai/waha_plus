import { Module } from '@nestjs/common';
import { WhatsappConfigService } from '@waha/config.service';
import { MediaLocalStorageFactory } from '@waha/plus/media/local/MediaLocalStorageFactory';
import { MediaStorageFactory } from '@waha/plus/media/MediaStorageFactory';

@Module({
  providers: [
    {
      provide: MediaStorageFactory,
      useClass: MediaLocalStorageFactory,
    },
    WhatsappConfigService,
  ],
  exports: [MediaStorageFactory],
})
export class MediaLocalStorageModule {}
