import { downloadMediaMessage, getStream } from '@adiwajshing/baileys';
import { Logger as BaileysLogger } from '@adiwajshing/baileys/node_modules/pino';
import { UnprocessableEntityException } from '@nestjs/common';
import {
  toJID,
  WhatsappSessionNoWebCore,
} from '@waha/core/engines/noweb/session.noweb.core';
import { extractMediaContent } from '@waha/core/engines/noweb/utils';
import { NowebStorageFactoryPlus } from '@waha/plus/engines/noweb/store/NowebStorageFactoryPlus';
import { CreateChannelRequest } from '@waha/structures/channels.dto';
import {
  MessageFileRequest,
  MessageImageRequest,
  MessageVideoRequest,
  MessageVoiceRequest,
} from '@waha/structures/chatting.dto';
import { BinaryFile, RemoteFile } from '@waha/structures/files.dto';
import {
  BROADCAST_ID,
  ImageStatus,
  VideoStatus,
  VoiceStatus,
} from '@waha/structures/status.dto';
import { LoggerBuilder } from '@waha/utils/logging';

import { EngineMediaProcessor as CoreEngineMediaProcessor } from '../../../core/engines/noweb/session.noweb.core';
import { NowebAuthFactoryPlus } from './NowebAuthFactoryPlus';

export class WhatsappSessionNoWebPlus extends WhatsappSessionNoWebCore {
  authFactory = new NowebAuthFactoryPlus();
  storageFactory = new NowebStorageFactoryPlus();

  fileToMessage(file: RemoteFile | BinaryFile, type, caption = '') {
    if (!('url' in file || 'data' in file)) {
      throw new UnprocessableEntityException(
        'Either file.url or file.data must be specified.',
      );
    }

    if ('url' in file) {
      return {
        [type]: { url: file.url },
        caption: caption,
        mimetype: file.mimetype,
        fileName: file.filename,
        ptt: type === 'audio',
      };
    } else if ('data' in file) {
      return {
        [type]: Buffer.from(file.data, 'base64'),
        mimetype: file.mimetype,
        caption: caption,
        fileName: file.filename,
        ptt: type === 'audio',
      };
    }
  }

  async sendImage(request: MessageImageRequest) {
    const message: any = this.fileToMessage(
      request.file,
      'image',
      request.caption,
    );
    const options = await this.getMessageOptions(request);
    const chatId = toJID(this.ensureSuffix(request.chatId));
    return this.sock.sendMessage(chatId, message, options);
  }

  async sendFile(request: MessageFileRequest) {
    const message: any = this.fileToMessage(
      request.file,
      'document',
      request.caption,
    );
    const chatId = toJID(this.ensureSuffix(request.chatId));
    const options = await this.getMessageOptions(request);
    return this.sock.sendMessage(chatId, message, options);
  }

  async sendVoice(request: MessageVoiceRequest) {
    const message: any = this.fileToMessage(request.file, 'audio');
    const chatId = toJID(this.ensureSuffix(request.chatId));
    const options = await this.getMessageOptions(request);
    return this.sock.sendMessage(chatId, message, options);
  }

  async sendVideo(request: MessageVideoRequest) {
    const message: any = this.fileToMessage(
      request.file,
      'video',
      request.caption,
    );
    const chatId = toJID(this.ensureSuffix(request.chatId));
    const options = await this.getMessageOptions(request);
    return this.sock.sendMessage(chatId, message, options);
  }

  protected downloadMedia(message) {
    const processor = new EngineMediaProcessor(this, this.loggerBuilder);
    return this.mediaManager.processMedia(processor, message, this.name);
  }

  /**
   * Status methods
   */
  public sendImageStatus(status: ImageStatus) {
    const message: any = this.fileToMessage(
      status.file,
      'image',
      status.caption,
    );
    const JIDs = status.contacts.map(toJID);
    this.upsertMeInJIDs(JIDs);
    const options = {
      statusJidList: JIDs,
    };
    return this.sock.sendMessage(BROADCAST_ID, message, options);
  }

  public sendVoiceStatus(status: VoiceStatus) {
    const message: any = this.fileToMessage(status.file, 'audio');
    const JIDs = status.contacts.map(toJID);
    this.upsertMeInJIDs(JIDs);
    const options = {
      backgroundColor: status.backgroundColor,
      statusJidList: JIDs,
    };
    return this.sock.sendMessage(BROADCAST_ID, message, options);
  }

  public sendVideoStatus(status: VideoStatus) {
    const message: any = this.fileToMessage(
      status.file,
      'video',
      status.caption,
    );
    const JIDs = status.contacts.map(toJID);
    this.upsertMeInJIDs(JIDs);
    const options = {
      statusJidList: JIDs,
    };
    return this.sock.sendMessage(BROADCAST_ID, message, options);
  }

  /**
   * Channels methods
   */
  public async channelsCreateChannel(request: CreateChannelRequest) {
    const channel = await super.channelsCreateChannel(request);

    if (request.picture) {
      let file = request.picture;
      let picture: any;
      // @ts-ignore
      if (file.url) {
        file = file as RemoteFile;
        picture = await getStream({ url: file.url });
        // @ts-ignore
      } else if (file.data) {
        file = file as BinaryFile;
        picture = Buffer.from(file.data, 'base64');
      }
      await this.sock.newsletterUpdatePicture(channel.id, picture);
    }
    return channel;
  }
}

function hasPath(url: string) {
  if (!url) {
    return false;
  }
  try {
    const urlObj = new URL(url);
    return urlObj.pathname !== '/';
  } catch (error) {
    return false;
  }
}

class EngineMediaProcessor extends CoreEngineMediaProcessor {
  private readonly logger: BaileysLogger;

  constructor(session: WhatsappSessionNoWebPlus, loggerBuilder: LoggerBuilder) {
    super(session);
    this.logger = loggerBuilder.child({
      name: EngineMediaProcessor.name,
    }) as unknown as BaileysLogger;
  }

  getMessageId(message: any): string {
    return message.key.id;
  }

  getMimetype(message: any): string {
    const content = extractMediaContent(message.message);
    return content.mimetype;
  }

  async getMediaBuffer(message: any): Promise<Buffer | null> {
    const content = extractMediaContent(message.message);
    // Fix Stickers
    // https://github.com/devlikeapro/waha/issues/504
    const url = content.url;
    if (!hasPath(url)) {
      // Set it to null so the engine handles it right
      content.url = null;
    }

    return (await downloadMediaMessage(
      message,
      'buffer',
      {},
      {
        logger: this.logger,
        reuploadRequest: this.session.sock.updateMediaMessage,
      },
    ).finally(() => {
      // Fix Stickers - set url back, just to have it in the response
      // https://github.com/devlikeapro/waha/issues/504
      content.url = url;
    })) as Buffer;
  }
}
