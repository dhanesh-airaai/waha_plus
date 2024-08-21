import { IMediaEngineProcessor } from '@waha/core/media/IMediaEngineProcessor';
import { IMediaManager } from '@waha/core/media/IMediaManager';
import {
  IMediaStorage,
  MediaData,
  MediaStorageData,
} from '@waha/core/media/IMediaStorage';
import { WAMedia } from '@waha/structures/responses.dto';
import { Logger } from 'pino';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const FileType = require('file-type');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mime = require('mime-types');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const promiseRetry = require('promise-retry');

export class MediaManagerPlus implements IMediaManager {
  // https://github.com/IndigoUnited/node-promise-retry
  RETRY_OPTIONS = {
    retries: 5,
    minTimeout: 100,
    maxTimeout: 500,
  };

  constructor(
    private storage: IMediaStorage,
    private mimetypes: string[],
    protected log: Logger,
  ) {
    // Log mimetypes
    if (this.mimetypes && this.mimetypes.length > 0) {
      const mimetypes = this.mimetypes.join(',');
      const msg = `Only '${mimetypes}' mimetypes will be downloaded for the session`;
      this.log.info(msg);
    }
  }

  /**
   *  Check that we need to download files with the mimetype
   */
  private shouldProcessMimetype(mimetype: string) {
    // No specific mimetypes provided - always download
    if (!this.mimetypes || this.mimetypes.length === 0) {
      return true;
    }
    // Found "right" mimetype in the list of allowed mimetypes - download it
    return this.mimetypes.some((type) => mimetype.startsWith(type));
  }

  async processMedia<Message>(
    processor: IMediaEngineProcessor<Message>,
    message: Message,
    session: string,
  ) {
    if (!processor.hasMedia(message)) {
      return message;
    }

    const messageId = processor.getMessageId(message);
    const mimetype = processor.getMimetype(message);
    const filename = processor.getFilename(message);
    if (!this.shouldProcessMimetype(mimetype)) {
      this.log.info(
        `The message '${messageId}' has '${mimetype}' mimetype media, skip it.`,
      );

      const media: WAMedia = {
        mimetype: mimetype,
        filename: filename,
        url: null,
      };
      // @ts-ignore
      message.media = media;
      return message;
    }

    const extension = mime.extension(mimetype);
    const mediaData: MediaData = {
      session: session,
      message: {
        id: messageId,
      },
      file: {
        extension: extension,
        filename: filename,
      },
    };

    const exists = await this.withRetry('Checking media', () =>
      this.exists(mediaData),
    );

    if (!exists) {
      this.log.info(`The message ${messageId} has media, processing it...`);

      // Fetching media
      const buffer = await this.withRetry('Fetching media', () =>
        this.fetchMedia(message, processor),
      );
      if (!buffer) {
        this.log.error(`Failed to fetch media for message '${messageId}'`);
        return message;
      }

      // Saving media
      const saved = await this.withRetry('Saving media', () =>
        this.saveMedia(buffer, mediaData),
      );
      if (!saved) {
        this.log.error(`Failed to save media for message '${messageId}'`);
        return message;
      }
      this.log.info(`The media from '${messageId}' has been processed.`);
    }

    const data = await this.withRetry('Getting media URL', () =>
      this.getStorageData(mediaData),
    );
    if (!data) {
      this.log.error(`Failed to get media URL for message '${messageId}'`);
      return message;
    }

    const media: WAMedia = {
      mimetype: mimetype,
      filename: filename,
      ...data,
    };
    // @ts-ignore
    message.media = media;
    return message;
  }

  private async fetchMedia(
    message: any,
    processor: IMediaEngineProcessor<any>,
  ): Promise<Buffer> {
    const messageId = processor.getMessageId(message);
    this.log.debug(`Fetching media from WhatsApp message '${messageId}'...`);
    const buffer = await processor.getMediaBuffer(message);
    if (!buffer) {
      throw new Error(
        `Message '${messageId}' has no media, but it has media flag in the engine`,
      );
    }
    return buffer;
  }

  private async saveMedia(
    buffer: Buffer,
    mediaData: MediaData,
  ): Promise<boolean> {
    this.log.debug(
      `Saving media from WhatsApp the message '${mediaData.message.id}'...`,
    );
    const result = await this.storage.save(buffer, mediaData);
    this.log.debug(`The media from '${mediaData.message.id}' has been saved.`);
    return result;
  }

  private async getStorageData(
    mediaData: MediaData,
  ): Promise<MediaStorageData> {
    return await this.storage.getStorageData(mediaData);
  }

  private async exists(mediaData: MediaData): Promise<boolean> {
    this.log.trace(
      `Checking if media exists for message '${mediaData.message.id}'...`,
    );
    const result = await this.storage.exists(mediaData);
    this.log.trace(
      `Media for message '${mediaData.message.id}' exists: ${result}`,
    );
    return result;
  }

  private async withRetry(name: string, fn: CallableFunction) {
    const retryOptions = this.RETRY_OPTIONS;
    try {
      return await promiseRetry((retry: CallableFunction, number: number) => {
        return fn().catch(retry);
      }, retryOptions);
    } catch (error) {
      this.log.error(
        { error: error },
        `Failed to execute '${name}', tried '${retryOptions.retries}' times`,
      );
      return null;
    }
  }
}
