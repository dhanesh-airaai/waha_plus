import { WhatsappSessionWebJSCore } from '@waha/core/engines/webjs/session.webjs.core';
import { WebjsClient } from '@waha/core/engines/webjs/WebjsClient';
import {
  MessageFileRequest,
  MessageImageRequest,
  MessageVideoRequest,
} from '@waha/structures/chatting.dto';
import { BinaryFile, RemoteFile } from '@waha/structures/files.dto';
import { Message, MessageMedia } from 'whatsapp-web.js';

import { EngineMediaProcessor as CoreEngineMediaProcessor } from '../../../core/engines/webjs/session.webjs.core';
import { WebJSAuthFactory } from './WebJSAuthFactory';

export class WhatsappSessionWebJSPlus extends WhatsappSessionWebJSCore {
  authFactory = new WebJSAuthFactory();

  protected getClassDirName() {
    return __dirname;
  }

  protected async buildClient() {
    const authStrategy = this.authFactory.buildAuth(
      this.sessionStore,
      this.name,
      this.loggerBuilder,
    );
    const clientOptions = this.getClientOptions();
    clientOptions.authStrategy = authStrategy;
    this.addProxyConfig(clientOptions);
    return new WebjsClient(clientOptions);
  }

  private async fileToMedia(file: BinaryFile | RemoteFile) {
    if ('url' in file) {
      const mediaOptions = { unsafeMime: true };
      const media = await MessageMedia.fromUrl(file.url, mediaOptions);
      media.mimetype = file.mimetype || media.mimetype;
      media.filename = file.filename || media.filename;
      return media;
    }
    return new MessageMedia(file.mimetype, file.data, file.filename);
  }

  async sendFile(request: MessageFileRequest) {
    const media = await this.fileToMedia(request.file);
    let options = this.getMessageOptions(request);
    options = {
      ...options,
      sendMediaAsDocument: true,
      caption: request.caption,
    };
    return this.whatsapp.sendMessage(request.chatId, media, options);
  }

  async sendImage(request: MessageImageRequest) {
    const media = await this.fileToMedia(request.file);
    let options = this.getMessageOptions(request);
    options = {
      ...options,
      caption: request.caption,
    };
    return this.whatsapp.sendMessage(request.chatId, media, options);
  }

  async sendVoice(request) {
    const media = await this.fileToMedia(request.file);
    let options = this.getMessageOptions(request);
    options = {
      ...options,
      sendAudioAsVoice: true,
    };
    return this.whatsapp.sendMessage(request.chatId, media, options);
  }

  async sendVideo(request: MessageVideoRequest) {
    const media = await this.fileToMedia(request.file);
    let options = this.getMessageOptions(request);
    options = {
      ...options,
      caption: request.caption,
    };
    return this.whatsapp.sendMessage(request.chatId, media, options);
  }

  protected downloadMedia(message: Message) {
    const processor = new EngineMediaProcessor();
    return this.mediaManager.processMedia(processor, message, this.name);
  }
}

class EngineMediaProcessor extends CoreEngineMediaProcessor {
  getMessageId(message: Message): string {
    return message.id._serialized;
  }

  getMimetype(message: Message): string {
    // @ts-ignore
    return message.rawData.mimetype;
  }

  async getMediaBuffer(message: Message): Promise<Buffer | null> {
    return message.downloadMedia().then((media: MessageMedia) => {
      if (!media) {
        return null;
      }
      return Buffer.from(media.data, 'base64');
    });
  }
}
