import { WAMessage } from '@adiwajshing/baileys';
import { LabelAssociation } from '@adiwajshing/baileys/lib/Types/LabelAssociation';
import { ILabelAssociationRepository } from '@waha/core/engines/noweb/store/ILabelAssociationsRepository';
import { ILabelsRepository } from '@waha/core/engines/noweb/store/ILabelsRepository';
import { NOWEB_STORE_SCHEMA } from '@waha/core/engines/noweb/store/Schema';
import { Field, Index, Schema } from '@waha/core/storage/sqlite3/Schema';
import { MongoLabelAssociationsRepository } from '@waha/plus/engines/noweb/store/mongodb/MongoLabelAssociationsRepository';
import { MongoLabelsRepository } from '@waha/plus/engines/noweb/store/mongodb/MongoLabelsRepository';
import { Db } from 'mongodb';

import { INowebStorage } from '../../../../../core/engines/noweb/store/INowebStorage';
import { MongoChatRepository } from './MongoChatRepository';
import { MongoContactRepository } from './MongoContactRepository';
import { MongoMessagesRepository } from './MongoMessagesRepository';

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
