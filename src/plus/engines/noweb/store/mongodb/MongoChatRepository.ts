import { Chat } from '@adiwajshing/baileys';
import { IChatRepository } from '@waha/core/engines/noweb/store/IChatRepository';

import { MongoRepository } from './MongoRepository';

export class MongoChatRepository
  extends MongoRepository<Chat>
  implements IChatRepository
{
  async getAllWithMessages(limit?: number, offset?: number): Promise<Chat[]> {
    // Get chats with conversationTimestamp is not Null
    // Sort by conversationTimestamp in descending order
    let query = this.collection
      .find({ conversationTimestamp: { $ne: NaN } })
      .sort({ conversationTimestamp: -1 });
    if (limit != null) query = query.limit(limit);
    if (offset != null) query = query.skip(offset);

    const rows = await query.toArray();
    return rows.map(MongoRepository.revive);
  }
}
