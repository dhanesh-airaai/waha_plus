import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IMediaStorage, MediaData } from '@waha/core/media/IMediaStorage';
import { Logger } from 'pino';

export class MediaS3Storage implements IMediaStorage {
  constructor(
    private client: S3Client,
    protected log: Logger,
    private bucket: string,
  ) {}

  private getKey(data: MediaData) {
    return `${data.message.id}.${data.file.extension}`;
  }

  async save(buffer: Buffer, data: MediaData): Promise<boolean> {
    const key = this.getKey(data);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      Metadata: {
        'my-key': 'some-value',
        session: 'default',
        'waha-metadata-user.id': '123',
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

  async getUrl(data: MediaData): Promise<string> {
    const key = this.getKey(data);
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }

  async purge(): Promise<void> {
    this.log.debug('Purging S3 bucket is not supported');
  }
}
