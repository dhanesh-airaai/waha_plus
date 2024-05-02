import { ISessionAuthRepository } from '../../core/storage/ISessionAuthRepository';
import { MongoSessionConfigRepository } from './MongoSessionConfigRepository';
import { MongoStore } from './MongoStore';

export class MongoSessionAuthRepository implements ISessionAuthRepository {
  private store: MongoStore;
  private configRepository: MongoSessionConfigRepository;

  constructor(store: MongoStore) {
    this.store = store;
    this.configRepository = new MongoSessionConfigRepository(this.store);
  }

  async init(sessionName?: string): Promise<void> {
    return;
  }

  async clean(sessionName: string): Promise<void> {
    const db = this.store.getSessionDb(sessionName);
    await db.dropDatabase();
  }

  async getAll(): Promise<string[]> {
    const sessions = await this.configRepository.getAll();
    return sessions.map((session) => session.name);
  }
}
