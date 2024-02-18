import { AuthStrategy, LocalAuth, RemoteAuth } from 'whatsapp-web.js';

import { DataStore } from '../../../core/abc/DataStore';
import { LocalStore } from '../../../core/storage/LocalStore';
import { MongoStore } from '../../storage/MongoStore';
import { WebJSMongoAuth } from './WebJSMongoAuth';

export class WebJSAuthFactory {
  buildAuth(store: DataStore, name: string): AuthStrategy {
    if (store instanceof MongoStore) return this.buildMongoAuth(store, name);
    if (store instanceof LocalStore) return this.buildLocalAuth(store, name);
    throw new Error(`Unsupported store type '${store.constructor.name}'`);
  }

  buildLocalAuth(store: LocalStore, name: string) {
    return new LocalAuth({
      clientId: name,
      dataPath: store.getSessionDirectory(name),
    });
  }

  private buildMongoAuth(store: MongoStore, name: string) {
    const authStore = new WebJSMongoAuth(store);
    return new RemoteAuth({
      clientId: name,
      store: authStore,
      backupSyncIntervalMs: 60 * 1000,
    });
  }
}
