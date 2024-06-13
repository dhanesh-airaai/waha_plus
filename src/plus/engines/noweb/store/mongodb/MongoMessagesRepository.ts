import { IMessagesRepository } from '../../../../../core/engines/noweb/store/IMessagesRepository';
import { MongoRepository } from './MongoRepository';

export class MongoMessagesRepository
  extends MongoRepository<any>
  implements IMessagesRepository
{
  upsert(messages: any[]): Promise<void> {
    return this.upsertMany(messages);
  }

  async getAllByJid(jid: string, limit: number): Promise<any[]> {
    const rows = await this.collection
      .find({ jid: jid })
      .sort({ messageTimestamp: -1 })
      .limit(limit)
      .toArray();
    return rows.map(MongoRepository.revive);
  }

  async getByJidById(jid: string, id: string): Promise<any> {
    return this.getBy({ jid: jid, id: id });
  }

  async updateByJidAndId(
    jid: string,
    id: string,
    update: any,
  ): Promise<boolean> {
    const entity = await this.getByJidById(jid, id);
    if (!entity) {
      return false;
    }
    Object.assign(entity, update);
    await this.upsertOne(entity);
  }

  async deleteByJidByIds(jid: string, ids: string[]): Promise<void> {
    await this.collection.deleteMany({ jid: jid, id: { $in: ids } });
  }

  deleteAllByJid(jid: string): Promise<void> {
    return this.deleteBy({ jid: jid });
  }
}
