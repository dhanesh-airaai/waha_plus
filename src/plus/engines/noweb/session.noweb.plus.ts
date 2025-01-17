import { getStream, prepareWAMessageMedia } from '@adiwajshing/baileys';
import { MediaGenerationOptions } from '@adiwajshing/baileys/lib/Types';
import { UnprocessableEntityException } from '@nestjs/common';
import {
  toJID,
  WhatsappSessionNoWebCore,
} from '@waha/core/engines/noweb/session.noweb.core';
import { parseBool } from '@waha/helpers';
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

import { NowebAuthFactoryPlus } from './store/NowebAuthFactoryPlus';

export class WhatsappSessionNoWebPlus extends WhatsappSessionNoWebCore {
  authFactory = new NowebAuthFactoryPlus();
  storageFactory = new NowebStorageFactoryPlus();

  protected async uploadMedia(
    file: RemoteFile | BinaryFile,
    type,
  ): Promise<any> {
    if (!file) {
      return;
    }
    if (!('url' in file || 'data' in file)) {
      return;
    }
    const message: any = this.fileToMessage(file, type);
    const options: MediaGenerationOptions = {
      logger: this.engineLogger,
      upload: this.sock.waUploadToServer,
    };
    const { imageMessage } = await prepareWAMessageMedia(message, options);
    return imageMessage;
  }

  protected fileToMessage(file: RemoteFile | BinaryFile, type, caption = '') {
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
    message.ptv = parseBool(request.asNote);
    return this.sock.sendMessage(chatId, message, options);
  }

  /**
   * Status methods
   */
  public async sendImageStatus(status: ImageStatus) {
    const message: any = this.fileToMessage(
      status.file,
      'image',
      status.caption,
    );
    const jids = await this.prepareJidsForStatus(status.contacts);
    const options = {
      statusJidList: jids,
    };
    return await this.sock.sendMessage(BROADCAST_ID, message, options);
  }

  public async sendVoiceStatus(status: VoiceStatus) {
    const message: any = this.fileToMessage(status.file, 'audio');
    const jids = await this.prepareJidsForStatus(status.contacts);
    const options = {
      backgroundColor: status.backgroundColor,
      statusJidList: jids,
    };
    return await this.sock.sendMessage(BROADCAST_ID, message, options);
  }

  public async sendVideoStatus(status: VideoStatus) {
    const message: any = this.fileToMessage(
      status.file,
      'video',
      status.caption,
    );
    const jids = await this.prepareJidsForStatus(status.contacts);
    const options = {
      statusJidList: jids,
    };
    return await this.sock.sendMessage(BROADCAST_ID, message, options);
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
