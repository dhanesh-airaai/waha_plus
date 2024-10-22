import { Chat } from '@adiwajshing/baileys';
import { IChatRepository } from '@waha/core/engines/noweb/store/IChatRepository';
import { PaginationParams } from '@waha/structures/pagination.dto';

import { MongoRepository } from './MongoRepository';

export class MongoChatRepository
  extends MongoRepository<Chat>
  implements IChatRepository
{
  async getAllWithMessages(pagination: PaginationParams): Promise<Chat[]> {
    // Get chats with conversationTimestamp is not Null
    // Sort by conversationTimestamp in descending order
    let query = this.collection.find({ conversationTimestamp: { $ne: NaN } });

    query = this.pagination(query, pagination);
    const rows = await query.toArray();
    return rows.map(MongoRepository.revive);
  }
}
