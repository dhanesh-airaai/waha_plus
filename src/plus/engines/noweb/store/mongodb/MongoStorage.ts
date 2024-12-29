import { IGroupRepository } from '@waha/core/engines/noweb/store/IGroupRepository';
import { ILabelAssociationRepository } from '@waha/core/engines/noweb/store/ILabelAssociationsRepository';
import { ILabelsRepository } from '@waha/core/engines/noweb/store/ILabelsRepository';
import { INowebStorage } from '@waha/core/engines/noweb/store/INowebStorage';
import { NOWEB_STORE_SCHEMA } from '@waha/core/engines/noweb/store/Schema';
import { Schema } from '@waha/core/storage/sqlite3/Schema';
import { MongoGroupRepository } from '@waha/plus/engines/noweb/store/mongodb/MongoGroupRepository';
import { MongoLabelAssociationsRepository } from '@waha/plus/engines/noweb/store/mongodb/MongoLabelAssociationsRepository';
import { MongoLabelsRepository } from '@waha/plus/engines/noweb/store/mongodb/MongoLabelsRepository';
import { Db } from 'mongodb';

import { MongoChatRepository } from './MongoChatRepository';
import { MongoContactRepository } from './MongoContactRepository';
import { MongoMessagesRepository } from './MongoMessagesRepository';

enum Order {
  ASC = 1,
  DESC = -1,
}

export class MongoStorage extends INowebStorage {
  private readonly tables: Schema[];

  constructor(private db: Db) {
    super();
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
      .createIndex({ id: Order.ASC }, { unique: true });
    // Chats
    await this.db
      .collection('chats')
      .createIndex({ id: Order.ASC }, { unique: true });
    await this.db
      .collection('chats')
      .createIndex({ conversationTimestamp: Order.ASC });
    // Groups
    await this.db
      .collection('groups')
      .createIndex({ id: Order.ASC }, { unique: true });
    // Messages
    await this.db
      .collection('messages')
      .createIndex({ id: Order.ASC }, { unique: true });
    await this.db
      .collection('messages')
      .createIndex({ jid: Order.ASC, id: Order.ASC }, { unique: true });
    await this.db
      .collection('messages')
      .createIndex({ jid: Order.ASC, messageTimestamp: Order.ASC });
    await this.db
      .collection('messages')
      .createIndex({ messageTimestamp: Order.ASC });

    //
    // Labels
    //
    await this.db.collection('labels').createIndex({ id: 1 }, { unique: true });
    // Label associations
    await this.db
      .collection('labelAssociations')
      .createIndex({ id: 1 }, { unique: true });
    await this.db
      .collection('labelAssociations')
      .createIndex({ type: 1, labelId: 1 });
    await this.db
      .collection('labelAssociations')
      .createIndex({ type: 1, chatId: 1 });
    await this.db
      .collection('labelAssociations')
      .createIndex({ type: 1, messageId: 1 });

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

  getGroupRepository(): IGroupRepository {
    return new MongoGroupRepository(this.db, this.getSchema('groups'));
  }

  getMessagesRepository() {
    const metadata = this.getMessagesMetadata();
    return new MongoMessagesRepository(
      this.db,
      this.getSchema('messages'),
      metadata,
    );
  }

  getLabelsRepository(): ILabelsRepository {
    return new MongoLabelsRepository(this.db, this.getSchema('labels'));
  }

  getLabelAssociationRepository(): ILabelAssociationRepository {
    const metadata = this.getLabelAssociationMetadata();
    return new MongoLabelAssociationsRepository(
      this.db,
      this.getSchema('labelAssociations'),
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
