import { getAudioDuration, getAudioWaveform } from '@adiwajshing/baileys';
import { UnprocessableEntityException } from '@nestjs/common';
import { Jid } from '@waha/core/engines/const';
import { messages } from '@waha/core/engines/gows/grpc/gows';
import { parseJson } from '@waha/core/engines/gows/helpers';
import { WhatsappSessionGoWSCore } from '@waha/core/engines/gows/session.gows.core';
import { toJID } from '@waha/core/engines/noweb/session.noweb.core';
import { sortObjectByValues } from '@waha/helpers';
import { GowsAuthFactoryPlus } from '@waha/plus/engines/gows/store/GowsAuthFactoryPlus';
import {
  Channel,
  ChannelListResult,
  ChannelMessage,
  ChannelSearchByText,
  ChannelSearchByView,
  CreateChannelRequest,
  PreviewChannelMessages,
} from '@waha/structures/channels.dto';
import {
  MessageFileRequest,
  MessageImageRequest,
  MessageVideoRequest,
  MessageVoiceRequest,
} from '@waha/structures/chatting.dto';
import { BinaryFile, RemoteFile } from '@waha/structures/files.dto';
import {
  ImageStatus,
  VideoStatus,
  VoiceStatus,
} from '@waha/structures/status.dto';
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { promisify } from 'util';

axiosRetry(axios, { retries: 3 });

export class WhatsappSessionGoWSPlus extends WhatsappSessionGoWSCore {
  protected authFactory = new GowsAuthFactoryPlus();

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

  /**
   * Profile methods
   */
  protected async setProfilePicture(
    file: BinaryFile | RemoteFile,
  ): Promise<boolean> {
    const media = await this.fileToMedia(file);
    const request = new messages.SetProfilePictureRequest({
      session: this.session,
      picture: media.content,
    });
    const response = await promisify(this.client.SetProfilePicture)(request);
    response.toObject();
    return true;
  }

  protected async deleteProfilePicture(): Promise<boolean> {
    const request = new messages.SetProfilePictureRequest({
      session: this.session,
    });
    const response = await promisify(this.client.SetProfilePicture)(request);
    response.toObject();
    return true;
  }

  /**
   * Groups methods
   */
  protected async setGroupPicture(
    id: string,
    file: BinaryFile | RemoteFile,
  ): Promise<boolean> {
    const media = await this.fileToMedia(file);
    const request = new messages.SetPictureRequest({
      session: this.session,
      jid: id,
      picture: media.content,
    });
    const response = await promisify(this.client.SetGroupPicture)(request);
    response.toObject();
    return true;
  }

  protected async deleteGroupPicture(id: string): Promise<boolean> {
    const request = new messages.SetPictureRequest({
      session: this.session,
      jid: id,
    });
    const response = await promisify(this.client.SetGroupPicture)(request);
    response.toObject();
    return true;
  }

  /**
   * Send media methods
   */
  private async sendMedia(type: messages.MediaType, request: any) {
    const jid = toJID(this.ensureSuffix(request.chatId));
    const media = await this.fileToMedia(request.file);
    media.type = type;

    // Only for Voice Status
    let backgroundColor: messages.OptionalString | null = null;
    if (request.backgroundColor) {
      backgroundColor = new messages.OptionalString({
        value: request.backgroundColor,
      });
    }

    const message = new messages.MessageRequest({
      jid: jid,
      text: request.caption,
      session: this.session,
      media: media,
      backgroundColor: backgroundColor,
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

  public async sendImageStatus(status: ImageStatus) {
    this.checkStatusRequest(status);
    const request: MessageImageRequest = {
      file: status.file,
      caption: status.caption,
      chatId: Jid.BROADCAST,
      session: null,
    };
    return await this.sendMedia(messages.MediaType.IMAGE, request);
  }

  public async sendVoiceStatus(status: VoiceStatus) {
    this.checkStatusRequest(status);
    const request: MessageVoiceRequest = {
      file: status.file,
      chatId: Jid.BROADCAST,
      session: null,
      // @ts-ignore
      backgroundColor: status.backgroundColor,
    };
    return await this.sendMedia(messages.MediaType.AUDIO, request);
  }

  public async sendVideoStatus(status: VideoStatus) {
    this.checkStatusRequest(status);
    const request: MessageVideoRequest = {
      file: status.file,
      caption: status.caption,
      chatId: Jid.BROADCAST,
      session: null,
    };
    return await this.sendMedia(messages.MediaType.VIDEO, request);
  }

  public async channelsCreateChannel(
    request: CreateChannelRequest,
  ): Promise<Channel> {
    const media = await this.fileToMedia(request.picture);
    const req = new messages.CreateNewsletterRequest({
      session: this.session,
      name: request.name,
      description: request.description,
      picture: media.content,
    });
    const response = await promisify(this.client.CreateNewsletter)(req);
    const newsletter = response.toObject() as messages.Newsletter;
    return this.toChannel(newsletter);
  }

  public async previewChannelMessages(
    inviteCode: string,
    query: PreviewChannelMessages,
  ): Promise<ChannelMessage[]> {
    const downloadMedia = query.downloadMedia;
    const request = new messages.GetNewsletterMessagesByInviteRequest({
      session: this.session,
      invite: inviteCode,
      limit: query.limit,
    });
    const response = await promisify(this.client.GetNewsletterMessagesByInvite)(
      request,
    );
    const resp = parseJson(response);
    const promises = [];
    for (const msg of resp.Messages) {
      promises.push(
        this.GowsChannelMessageToChannelMessage(
          resp.NewsletterJID,
          msg,
          downloadMedia,
        ),
      );
    }
    let result = await Promise.all(promises);
    result = result.filter(Boolean);
    return result;
  }

  private async GowsChannelMessageToChannelMessage(
    jid: string,
    channelMessage: any,
    downloadMedia: boolean,
  ): Promise<ChannelMessage> {
    const msg = {
      Info: {
        ID: channelMessage.MessageID,
        Chat: jid,
        Sender: jid,
        IsFromMe: false,
        Timestamp: channelMessage.Timestamp,
      },
      Message: channelMessage.Message,
    };
    const message = await this.processIncomingMessage(msg, downloadMedia);
    const reactions: any =
      sortObjectByValues(channelMessage.ReactionCounts) || {};
    return {
      message: message,
      reactions: reactions,
      viewCount: channelMessage.ViewsCount,
    };
  }

  /**
   * Channels Search methods
   */
  public async searchChannelsByView(
    query: ChannelSearchByView,
  ): Promise<ChannelListResult> {
    const request = new messages.SearchNewslettersByViewRequest({
      session: this.session,
      view: query.view,
      categories: query.categories,
      countries: query.countries,
      page: new messages.SearchPage({
        limit: query.limit,
        startCursor: query.startCursor,
      }),
    });
    const response = await promisify(this.client.SearchNewslettersByView)(
      request,
    );
    return this.channelsRawDataToResponse(response);
  }

  public async searchChannelsByText(
    query: ChannelSearchByText,
  ): Promise<ChannelListResult> {
    const request = new messages.SearchNewslettersByTextRequest({
      session: this.session,
      text: query.text,
      categories: query.categories,
      page: new messages.SearchPage({
        limit: query.limit,
        startCursor: query.startCursor,
      }),
    });
    const response = await promisify(this.client.SearchNewslettersByText)(
      request,
    );
    return this.channelsRawDataToResponse(response);
  }

  private channelsRawDataToResponse(
    data: messages.NewsletterSearchPageResult,
  ): ChannelListResult {
    const channels: Channel[] = data.newsletters.newsletters.map(
      this.toChannel.bind(this),
    );
    channels.forEach((channel) => {
      delete channel.role;
    });
    return {
      page: {
        startCursor: data.page.startCursor,
        endCursor: data.page.endCursor,
        hasNextPage: data.page.hasNextPage,
        hasPreviousPage: data.page.hasPreviousPage,
      },
      channels: channels,
    };
  }
}
