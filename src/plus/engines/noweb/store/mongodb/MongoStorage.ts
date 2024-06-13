import { WAMessage } from '@adiwajshing/baileys';
import { Db } from 'mongodb';

import { INowebStorage } from '../../../../../core/engines/noweb/store/INowebStorage';
import {
  Field,
  Index,
  NOWEB_STORE_SCHEMA,
  Schema,
} from '../../../../../core/engines/noweb/store/Schema';
import { MongoChatRepository } from './MongoChatRepository';
import { MongoContactRepository } from './MongoContactRepository';
import { MongoMessagesRepository } from './MongoMessagesRepository';

export class MongoStorage implements INowebStorage {
  private readonly tables: Schema[];

  constructor(private db: Db) {
    this.tables = NOWEB_STORE_SCHEMA;
  }

  async init() {
    await this.upsertIndexes();
    return;
  }

  async upsertIndexes() {
    // Contacts
    await this.db
      .collection('contacts')
      .createIndex({ id: 1 }, { unique: true });
    // Chats
    await this.db.collection('chats').createIndex({ id: 1 }, { unique: true });
    await this.db.collection('chats').createIndex({ conversationTimestamp: 1 });
    // Messages
    await this.db
      .collection('messages')
      .createIndex({ id: 1 }, { unique: true });
    await this.db
      .collection('messages')
      .createIndex({ jid: 1, id: 1 }, { unique: true });
    await this.db
      .collection('messages')
      .createIndex({ jid: 1, messageTimestamp: 1 });
    await this.db.collection('messages').createIndex({ messageTimestamp: 1 });
    return;
  }

  async close() {
    return;
  }

  getContactsRepository() {
    return new MongoContactRepository(this.db, this.getSchema('contacts'));
  }

  getChatRepository() {
    return new MongoChatRepository(this.db, this.getSchema('chats'));
  }

  getMessagesRepository() {
    const metadata = new Map()
      .set('jid', (msg: WAMessage) => msg.key.remoteJid)
      .set('id', (msg: WAMessage) => msg.key.id)
      .set('messageTimestamp', (msg: WAMessage) => msg.messageTimestamp);
    return new MongoMessagesRepository(
      this.db,
      this.getSchema('messages'),
      metadata,
    );
  }

  getSchema(name: string) {
    const schema = this.tables.find((table) => table.name === name);
    if (!schema) {
      throw new Error(`Schema not found: ${name}`);
    }
    return schema;
  }
}
