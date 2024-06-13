import { DataStore } from '@waha/core/abc/DataStore';
import { INowebStorage } from '@waha/core/engines/noweb/store/INowebStorage';
import { NowebStorageFactoryCore } from '@waha/core/engines/noweb/store/NowebStorageFactoryCore';
import { Sqlite3Storage } from '@waha/core/engines/noweb/store/sqlite3/Sqlite3Storage';
import { LocalStore } from '@waha/core/storage/LocalStore';
import { MongoStorage } from '@waha/plus/engines/noweb/store/mongodb/MongoStorage';
import { MongoStore } from '@waha/plus/storage/MongoStore';

export class NowebStorageFactoryPlus extends NowebStorageFactoryCore {
  createStorage(store: DataStore, name: string): INowebStorage {
    if (store instanceof LocalStore)
      return this.buildStorageSqlite3(store, name);
    if (store instanceof MongoStore) return this.buildStorageMongo(store, name);
    throw new Error(`Unsupported store type '${store.constructor.name}'`);
  }

  private buildStorageSqlite3(store: LocalStore, name: string) {
    const filePath = store.getFilePath(name, 'store.sqlite3');
    return new Sqlite3Storage(filePath);
  }

  private buildStorageMongo(store: MongoStore, name: string) {
    const db = store.getSessionDb(name);
    return new MongoStorage(db);
  }
}
