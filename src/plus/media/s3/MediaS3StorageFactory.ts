import { S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { IMediaStorage } from '@waha/core/media/IMediaStorage';
import { MediaStorageFactory } from '@waha/plus/media/MediaStorageFactory';
import { MediaS3Storage } from '@waha/plus/media/s3/MediaS3Storage';
import { MediaS3StorageConfig } from '@waha/plus/media/s3/MediaS3StorageConfig';
import { Logger } from 'pino';

@Injectable()
export class MediaS3StorageFactory extends MediaStorageFactory {
  private readonly defaultBucket: string;

  constructor(
    private s3client: S3Client,
    private s3config: MediaS3StorageConfig,
  ) {
    super();
    this.defaultBucket = this.s3config.bucket;
  }

  build(logger: Logger): IMediaStorage {
    return new MediaS3Storage(this.s3client, this.defaultBucket, logger);
  }
}
