import { DataStore } from '@waha/core/abc/DataStore';
import { INowebStorage } from '@waha/core/engines/noweb/store/INowebStorage';
import { NowebStorageFactoryCore } from '@waha/core/engines/noweb/store/NowebStorageFactoryCore';
import { MongoStorage } from '@waha/plus/engines/noweb/store/mongodb/MongoStorage';
import { MongoStore } from '@waha/plus/storage/mongo/MongoStore';

export class NowebStorageFactoryPlus extends NowebStorageFactoryCore {
  createStorage(store: DataStore, name: string): INowebStorage {
    if (store instanceof MongoStore) {
      return this.buildStorageMongo(store, name);
    }
    return super.createStorage(store, name);
  }

  private buildStorageMongo(store: MongoStore, name: string) {
    const db = store.getSessionDb(name);
    return new MongoStorage(db);
  }
}
