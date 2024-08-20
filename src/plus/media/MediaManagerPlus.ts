import { IMediaEngineProcessor } from '@waha/core/media/IMediaEngineProcessor';
import { IMediaManager } from '@waha/core/media/IMediaManager';
import { IMediaStorage } from '@waha/core/media/IMediaStorage';
import { WAMedia } from '@waha/structures/responses.dto';
import { Logger } from 'pino';
import { sleep } from 'venom-bot/dist/utils/sleep';

export class MediaManagerPlus implements IMediaManager {
  constructor(
    private storage: IMediaStorage,
    private mimetypes: string[],
    protected log: Logger,
  ) {
    if (this.mimetypes && this.mimetypes.length > 0) {
      this.log.info(
        `Only '${this.mimetypes.join(
          ',',
        )}' mimetypes will be downloaded for the session`,
      );
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

    this.log.info(`The message ${messageId} has media, processing it...`);
    let buffer;

    // Repeat three times to avoid errors
    const retries = 5;
    for (let i = 0; i < retries; i++) {
      this.log.info(
        `Downloading media from WhatsApp the message '${messageId}, attempt ${
          i + 1
        }/${retries}...`,
      );
      try {
        buffer = await processor.getMediaBuffer(message);
      } catch (e) {
        this.log.error(`Error downloading media: ${e}`);
        this.log.info(`Waiting 1 second and trying again...`);
        await sleep(1_000);
        continue;
      }
      if (buffer) {
        break;
      }
      this.log.info(
        `Message ${messageId} has no media, but it has media flag.`,
      );
      this.log.info(`Waiting 2 seconds and trying again...`);
      await sleep(2_000);
    }

    if (!buffer) {
      this.log.info(`No media found for ${messageId}.`);
      return message;
    }

    this.log.debug(
      `Downloading media from WhatsApp the message ${messageId}...`,
    );
    const url = await this.storage.save(messageId, mimetype, buffer);
    this.log.info(`The file from ${messageId} has been saved to ${url}`);

    const media: WAMedia = {
      mimetype: mimetype,
      filename: filename,
      url: url,
    };
    // @ts-ignore
    message.media = media;
    return message;
  }
}
