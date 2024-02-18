import { ConsoleLogger } from '@nestjs/common';
import * as path from 'path';
import { promisify } from 'util';

import {
  IEngineMediaProcessor,
  MediaManager,
  MediaStorage,
} from '../core/abc/media.abc';
import { SECOND } from '../structures/enums.dto';
import { WAMedia } from '../structures/responses.dto';
import fs = require('fs');
import del = require('del');
import { sleep } from 'venom-bot/dist/utils/sleep';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mime = require('mime-types');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FileType = require('file-type');
const writeFileAsync = promisify(fs.writeFile);

export class MediaStoragePlus implements MediaStorage {
  private readonly lifetimeMs: number;

  constructor(
    protected log: ConsoleLogger,
    private filesFolder: string,
    private baseUrl: string,
    lifetimeSeconds: number,
  ) {
    this.lifetimeMs = lifetimeSeconds * SECOND;
    if (this.lifetimeMs === 0) {
      this.log.log('Files lifetime is 0, files will not be removed');
    }
  }

  public async save(messageId, mimetype, buffer): Promise<string> {
    if (!mimetype) {
      mimetype = (await FileType.fromBuffer(buffer)).mime;
    }

    const filename = `${messageId}.${mime.extension(mimetype)}`;
    const filepath = path.resolve(`${this.filesFolder}/${filename}`);
    await writeFileAsync(filepath, buffer);
    this.postponeRemoval(filepath);
    return this.baseUrl + filename;
  }

  private postponeRemoval(filepath: string) {
    if (this.lifetimeMs === 0) {
      return;
    }
    setTimeout(
      () =>
        fs.unlink(filepath, () => {
          this.log.log(`File ${filepath} was removed`);
        }),
      this.lifetimeMs,
    );
  }

  purge() {
    if (this.lifetimeMs === 0) {
      this.log.log('No need to purge files with lifetime 0');
      return;
    }
    if (fs.existsSync(this.filesFolder)) {
      del([`${this.filesFolder}/*`], { force: true }).then((paths) => {
        if (paths.length === 0) {
          return;
        }
        this.log.log('Deleted files and directories:\n', paths.join('\n'));
      });
    } else {
      fs.mkdirSync(this.filesFolder);
      this.log.log(`Directory '${this.filesFolder}' created from scratch`);
    }
  }
}

export class PlusMediaManager implements MediaManager {
  constructor(
    private storage: MediaStorage,
    private mimetypes: string[],
    protected log: ConsoleLogger,
  ) {
    if (this.mimetypes && this.mimetypes.length > 0) {
      this.log.log(
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
    processor: IEngineMediaProcessor<Message>,
    message: Message,
  ) {
    if (!processor.hasMedia(message)) {
      return message;
    }

    const messageId = processor.getMessageId(message);
    const mimetype = processor.getMimetype(message);
    const filename = processor.getFilename(message);
    if (!this.shouldProcessMimetype(mimetype)) {
      this.log.log(
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

    this.log.log(`The message ${messageId} has media, processing it...`);
    let buffer;

    // Repeat three times to avoid errors
    const retries = 5;
    for (let i = 0; i < retries; i++) {
      this.log.log(
        `Downloading media from WhatsApp the message '${messageId}, attempt ${
          i + 1
        }/${retries}...`,
      );
      buffer = await processor.getMediaBuffer(message);
      if (buffer) {
        break;
      }
      this.log.log(`Message ${messageId} has no media, but it has media flag.`);
      this.log.log(`Waiting 2 seconds and trying again...`);
      await sleep(2_000);
    }

    if (!buffer) {
      this.log.log(`No media found for ${messageId}.`);
      return message;
    }

    this.log.debug(
      `Downloading media from WhatsApp the message ${messageId}...`,
    );
    const url = await this.storage.save(messageId, mimetype, buffer);
    this.log.log(`The file from ${messageId} has been saved to ${url}`);

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
