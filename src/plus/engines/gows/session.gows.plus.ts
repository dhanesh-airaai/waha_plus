import { getAudioDuration, getAudioWaveform } from '@adiwajshing/baileys';
import { messages } from '@waha/core/engines/gows/grpc/gows';
import { WhatsappSessionGoWSCore } from '@waha/core/engines/gows/session.gows.core';
import {
  toCusFormat,
  toJID,
} from '@waha/core/engines/noweb/session.noweb.core';
import {
  MessageFileRequest,
  MessageImageRequest,
  MessageVideoRequest,
  MessageVoiceRequest,
} from '@waha/structures/chatting.dto';
import { BinaryFile, RemoteFile } from '@waha/structures/files.dto';
import axios from 'axios';
import { Logger } from 'pino';
import { promisify } from 'util';

export class WhatsappSessionGoWSPlus extends WhatsappSessionGoWSCore {
  private async fetch(url: string): Promise<Buffer> {
    // fetch url using axios
    return axios.get(url, { responseType: 'arraybuffer' }).then((res) => {
      return Buffer.from(res.data);
    });
  }

  private async fileToMedia(
    file: RemoteFile | BinaryFile,
  ): Promise<messages.Media> {
    let content: Buffer;
    if ('url' in file) {
      // fetch file
      content = await this.fetch(file.url);
    } else {
      // base64 to bytes
      content = Buffer.from(file.data, 'base64');
    }

    return new messages.Media({
      content: content,
      mimetype: file.mimetype,
    });
  }

  private async sendMedia(type: messages.MediaType, request: any) {
    const jid = toJID(this.ensureSuffix(request.chatId));
    const media = await this.fileToMedia(request.file);
    media.type = type;
    const message = new messages.MessageRequest({
      jid: jid,
      text: request.caption,
      session: this.session,
      media: media,
    });

    if (media.type == messages.MediaType.AUDIO) {
      const logger: any = this.loggerBuilder.child({});
      const buffer = Buffer.from(media.content);
      const waveform = await getAudioWaveform(buffer, logger);
      const duration = await getAudioDuration(buffer);
      media.audio = new messages.AudioInfo({
        waveform: waveform,
        duration: duration,
      });
    }

    const response = await promisify(this.client.SendMessage)(message);
    const data = response.toObject();
    return this.messageResponse(jid, data);
  }

  async sendImage(request: MessageImageRequest) {
    return await this.sendMedia(messages.MediaType.IMAGE, request);
  }

  async sendFile(request: MessageFileRequest) {
    return await this.sendMedia(messages.MediaType.DOCUMENT, request);
  }

  async sendVoice(request: MessageVoiceRequest) {
    return await this.sendMedia(messages.MediaType.AUDIO, request);
  }

  async sendVideo(request: MessageVideoRequest) {
    return await this.sendMedia(messages.MediaType.VIDEO, request);
  }
}
