import { Module } from '@nestjs/common';
import { WhatsappConfigService } from '@waha/config.service';
import { MediaStorageFactory } from '@waha/plus/media/MediaStorageFactory';
import { MediaS3StorageFactory } from '@waha/plus/media/s3/MediaS3StorageFactory';

@Module({
  providers: [
    {
      provide: MediaStorageFactory,
      useClass: MediaS3StorageFactory,
    },
    WhatsappConfigService,
  ],
  exports: [MediaStorageFactory],
})
export class MediaS3StorageModule {}
