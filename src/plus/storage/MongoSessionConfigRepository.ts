import { Collection, Db } from 'mongodb';
import { SessionConfig } from 'src/structures/sessions.dto';

import { ISessionConfigRepository } from '../../core/storage/ISessionConfigRepository';
import { MongoStore } from './MongoStore';

class SessionConfigWithName extends SessionConfig {
  name: string;
}

export class MongoSessionConfigRepository extends ISessionConfigRepository {
  private collection: Collection<SessionConfigWithName>;

  constructor(store: MongoStore) {
    super();
    this.collection = store.getMainDb().collection('sessions');
  }

  async save(sessionName: string, config: SessionConfig): Promise<void> {
    await this.collection.replaceOne(
      { name: sessionName },
      { ...config, name: sessionName },
      { upsert: true },
    );
  }

  async get(sessionName: string): Promise<SessionConfig> {
    const result = await this.collection.findOne({
      name: sessionName,
    });
    delete result._id;
    delete result.name;
    return result;
  }

  async delete(sessionName: string): Promise<void> {
    await this.collection.deleteOne({ name: sessionName });
  }

  async getAll(): Promise<SessionConfigWithName[]> {
    return await this.collection.find().toArray();
  }
}
