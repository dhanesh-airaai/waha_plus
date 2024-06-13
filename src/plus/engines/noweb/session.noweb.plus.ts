import { downloadMediaMessage } from '@adiwajshing/baileys';
import { UnprocessableEntityException } from '@nestjs/common';
import {
  toJID,
  WhatsappSessionNoWebCore,
} from '@waha/core/engines/noweb/session.noweb.core';
import { extractMediaContent } from '@waha/core/engines/noweb/utils';
import { NowebStorageFactoryPlus } from '@waha/plus/engines/noweb/store/NowebStorageFactoryPlus';
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

import { EngineMediaProcessor as CoreEngineMediaProcessor } from '../../../core/engines/noweb/session.noweb.core';
import { NowebAuthFactoryPlus } from './NowebAuthFactoryPlus';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const logger = require('pino')();

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

  sendImage(request: MessageImageRequest) {
    const message: any = this.fileToMessage(
      request.file,
      'image',
      request.caption,
    );
    const chatId = toJID(this.ensureSuffix(request.chatId));
    return this.sock.sendMessage(chatId, message);
  }

  sendFile(request: MessageFileRequest) {
    const message: any = this.fileToMessage(
      request.file,
      'document',
      request.caption,
    );
    const chatId = toJID(this.ensureSuffix(request.chatId));
    return this.sock.sendMessage(chatId, message);
  }

  sendVoice(request: MessageVoiceRequest) {
    const message: any = this.fileToMessage(request.file, 'audio');
    const chatId = toJID(this.ensureSuffix(request.chatId));
    return this.sock.sendMessage(chatId, message);
  }

  sendVideo(request: MessageVideoRequest) {
    const message: any = this.fileToMessage(
      request.file,
      'video',
      request.caption,
    );
    const chatId = toJID(this.ensureSuffix(request.chatId));
    return this.sock.sendMessage(chatId, message);
  }

  protected downloadMedia(message) {
    const processor = new EngineMediaProcessor(this);
    return this.mediaManager.processMedia(processor, message);
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
}

class EngineMediaProcessor extends CoreEngineMediaProcessor {
  getMessageId(message: any): string {
    return message.key.id;
  }

  getMimetype(message: any): string {
    const content = extractMediaContent(message.message);
    return content.mimetype;
  }

  async getMediaBuffer(message: any): Promise<Buffer | null> {
    return (await downloadMediaMessage(
      message,
      'buffer',
      {},
      {
        logger: logger,
        reuploadRequest: this.session.sock.updateMediaMessage,
      },
    )) as Buffer;
  }
}
