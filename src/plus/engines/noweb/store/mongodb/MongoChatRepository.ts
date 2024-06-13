import { Chat } from '@adiwajshing/baileys';

import { IChatRepository } from '../../../../../core/engines/noweb/store/IChatRepository';
import { MongoRepository } from './MongoRepository';

export class MongoChatRepository
  extends MongoRepository<Chat>
  implements IChatRepository
{
  async getAllWithMessages(): Promise<Chat[]> {
    // Get chats with conversationTimestamp is not Null
    // Sort by conversationTimestamp in descending order
    const rows = await this.collection
      .find({ conversationTimestamp: { $ne: NaN } })
      .sort({ conversationTimestamp: -1 })
      .toArray();
    return rows.map(MongoRepository.revive);
  }
}
