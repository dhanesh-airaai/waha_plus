import { S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { WhatsappConfigService } from '@waha/config.service';
import { IMediaStorage } from '@waha/core/media/IMediaStorage';
import { MediaStorageFactory } from '@waha/plus/media/MediaStorageFactory';
import { MediaS3Storage } from '@waha/plus/media/s3/MediaS3Storage';
import { Logger } from 'pino';

@Injectable()
export class MediaS3StorageFactory extends MediaStorageFactory {
  private readonly s3client: S3Client;
  private readonly defaultBucket: string;

  constructor(private config: WhatsappConfigService) {
    super();

    const region = this.config.get('WAHA_S3_REGION');
    if (!region) {
      throw new Error('WAHA_S3_REGION is required');
    }
    const accessKeyId = this.config.get('WAHA_S3_ACCESS_KEY_ID');
    if (!accessKeyId) {
      throw new Error('WAHA_S3_ACCESS_KEY_ID is required');
    }
    const secretAccessKey = this.config.get('WAHA_S3_SECRET_ACCESS_KEY');
    if (!secretAccessKey) {
      throw new Error('WAHA_S3_SECRET_ACCESS_KEY is required');
    }
    const endpoint = this.config.get('WAHA_S3_ENDPOINT', undefined);
    this.s3client = new S3Client({
      region: region,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
      endpoint: endpoint,
    });
    this.defaultBucket = this.config.get('WAHA_S3_BUCKET');
    if (!this.defaultBucket) {
      throw new Error('WAHA_S3_BUCKET is required');
    }
  }

  build(logger: Logger): IMediaStorage {
    return new MediaS3Storage(this.s3client, this.defaultBucket, logger);
  }
}
