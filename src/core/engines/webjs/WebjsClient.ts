import { GetChatMessagesFilter } from '@waha/structures/chats.dto';
import { PaginationParams } from '@waha/structures/pagination.dto';
import * as lodash from 'lodash';
import { Client } from 'whatsapp-web.js';
import { Message } from 'whatsapp-web.js/src/structures';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LoadWAHA } = require('./_WAHA.js');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LoadLodash } = require('./_lodash.js');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { LoadPaginator } = require('./_Paginator.js');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ChatFactory = require('whatsapp-web.js/src/factories/ChatFactory');

export class WebjsClient extends Client {
  async inject() {
    // Even tho this.inject is not defined as interface in Client.ts
    // We can still call and override it
    // @ts-ignore
    await super.inject();

    // Load util functions (serializers, helper functions)
    await this.pupPage.evaluate(LoadLodash);
    await this.pupPage.evaluate(LoadPaginator);
    await this.pupPage.evaluate(LoadWAHA);
  }

  async getChats(pagination?: PaginationParams) {
    if (lodash.isEmpty(pagination)) {
      return await super.getChats();
    }

    // Get paginated chats
    pagination.limit ||= Infinity;
    pagination.offset ||= 0;

    const chats = await this.pupPage.evaluate(async (pagination) => {
      // @ts-ignore
      return await window.WAHA.getChats(pagination);
    }, pagination);

    return chats.map((chat) => ChatFactory.create(this, chat));
  }

  async getMessages(
    chatId: string,
    filter: GetChatMessagesFilter,
    pagination: PaginationParams,
  ) {
    const messages = await this.pupPage.evaluate(
      async (chatId, filter, pagination) => {
        pagination.limit ||= Infinity;
        pagination.offset ||= 0;

        const msgFilter = (m) => {
          if (m.isNotification) {
            return false;
          }
          if (
            filter['filter.fromMe'] != null &&
            m.id.fromMe !== filter['filter.fromMe']
          ) {
            return false;
          }
          if (
            filter['filter.timestamp.gte'] != null &&
            m.t < filter['filter.timestamp.gte']
          ) {
            return false;
          }
          if (
            filter['filter.timestamp.lte'] != null &&
            m.t > filter['filter.timestamp.lte']
          ) {
            return false;
          }
          return true;
        };

        // @ts-ignore
        const chat = await window.WWebJS.getChat(chatId, { getAsModel: false });
        let msgs = chat.msgs.getModelsArray().filter(msgFilter);

        while (msgs.length < pagination.limit + pagination.offset) {
          const loadedMessages =
            // @ts-ignore
            await window.Store.ConversationMsgs.loadEarlierMsgs(chat);
          if (!loadedMessages || !loadedMessages.length) break;
          msgs = [...loadedMessages.filter(msgFilter), ...msgs];
        }

        if (msgs.length > pagination.limit + pagination.offset) {
          // sort by t - new first
          msgs = msgs.sort((a, b) => b.t - a.t);
          msgs = msgs.slice(
            pagination.offset,
            pagination.limit + pagination.offset,
          );
        }

        // @ts-ignore
        return msgs.map((m) => window.WWebJS.getMessageModel(m));
      },
      chatId,
      filter,
      pagination,
    );

    return messages.map((m) => new Message(this, m));
  }
}
