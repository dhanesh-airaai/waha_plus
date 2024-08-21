import { Module } from '@nestjs/common';
import { WhatsappConfigService } from '@waha/config.service';
import { MediaStorageFactory } from '@waha/plus/media/MediaStorageFactory';
import { MediaS3StorageConfig } from '@waha/plus/media/s3/MediaS3StorageConfig';
import { MediaS3StorageFactory } from '@waha/plus/media/s3/MediaS3StorageFactory';

@Module({
  providers: [
    {
      provide: MediaStorageFactory,
      useClass: MediaS3StorageFactory,
    },
    WhatsappConfigService,
    MediaS3StorageConfig,
  ],
  exports: [MediaStorageFactory],
})
export class MediaS3StorageModule {}
