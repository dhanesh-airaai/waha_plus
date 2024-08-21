import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  IMediaStorage,
  MediaData,
  MediaStorageData,
} from '@waha/core/media/IMediaStorage';
import { Logger } from 'pino';

export class MediaS3Storage implements IMediaStorage {
  constructor(
    private client: S3Client,
    private bucket: string,
    protected log: Logger,
  ) {}

  private getKey(data: MediaData) {
    return `${data.session}/${data.message.id}.${data.file.extension}`;
  }

  async save(buffer: Buffer, data: MediaData): Promise<boolean> {
    const key = this.getKey(data);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      Metadata: {
        'waha-session': data.session,
        'waha-message-id': data.message.id,
        'waha-media-filename': data.file.filename,
      },
    });
    await this.client.send(command);
    return true;
  }

  async exists(data: MediaData): Promise<boolean> {
    const key = this.getKey(data);
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (e) {
      if (e.name === 'NotFound') {
        return false;
      }
      throw e;
    }
  }

  async getStorageData(data: MediaData): Promise<MediaStorageData> {
    const key = this.getKey(data);
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    const url = await getSignedUrl(this.client, command, { expiresIn: 3600 });
    return {
      url: url,
      s3: {
        Bucket: this.bucket,
        Key: key,
      },
    };
  }

  async purge(): Promise<void> {
    this.log.debug('Purging S3 bucket is not supported');
  }
}
