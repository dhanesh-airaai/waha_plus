import { MongoClient } from 'mongodb';

import { DataStore } from '../../core/abc/DataStore';

export class MongoStore extends DataStore {
  private mongo: MongoClient;
  private engine: string;

  constructor(mongo: MongoClient, engine: string) {
    super();
    if (!mongo)
      throw new Error(
        'A valid MongoClient instance is required for MongoStore.',
      );
    this.mongo = mongo;
    this.engine = engine.toLowerCase();
  }

  protected getMainDbName() {
    return `waha_${this.engine.toLowerCase()}`;
  }

  protected getSessionDbName(name: string) {
    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '_');
    return `${this.getMainDbName()}_${slug}`;
  }

  getMainDb() {
    return this.mongo.db(this.getMainDbName());
  }

  getSessionDb(name: string) {
    return this.mongo.db(this.getSessionDbName(name));
  }

  protected async listDatabases() {
    const result = await this.mongo.db().admin().listDatabases();
    return result.databases.map((db) => db.name);
  }

  async listSessions() {
    const mainDb = this.getMainDbName();
    const databases = await this.listDatabases();
    const prefix = `${mainDb}_`;
    return databases
      .filter((db) => db.startsWith(prefix))
      .map((db) => db.replace(prefix, ''));
  }
}
