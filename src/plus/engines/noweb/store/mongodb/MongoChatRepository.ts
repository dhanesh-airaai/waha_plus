import { Chat } from '@adiwajshing/baileys';
import { IChatRepository } from '@waha/core/engines/noweb/store/IChatRepository';
import { PaginationParams } from '@waha/structures/pagination.dto';

import { MongoRepository } from './MongoRepository';

export class MongoChatRepository
  extends MongoRepository<Chat>
  implements IChatRepository
{
  async getAllWithMessages(
    pagination: PaginationParams,
    broadcast: boolean,
  ): Promise<Chat[]> {
    // Get chats with conversationTimestamp is not Null
    // Sort by conversationTimestamp in descending order
    const filter = { conversationTimestamp: { $ne: NaN } };

    if (!broadcast) {
      // filter out chat by id if it ends at @newsletter or @broadcast
      filter['id'] = { $not: { $regex: /@broadcast|@newsletter/ } };
    }

    let query = this.collection.find(filter);
    query = this.pagination(query, pagination);
    const rows = await query.toArray();
    return rows.map(MongoRepository.revive);
  }
}
