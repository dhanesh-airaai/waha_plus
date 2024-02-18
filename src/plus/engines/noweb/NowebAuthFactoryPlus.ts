import { Store } from 'whatsapp-web.js';

import { DataStore } from '../../../core/abc/DataStore';
import { NowebAuthFactoryCore } from '../../../core/engines/noweb/NowebAuthFactoryCore';
import { LocalStore } from '../../../core/storage/LocalStore';
import { MongoStore } from '../../storage/MongoStore';
import { NoWebMongoDbAuth } from './NoWebMongoDbAuth';

export class NowebAuthFactoryPlus extends NowebAuthFactoryCore {
  buildAuth(store: DataStore, name: string) {
    if (store instanceof MongoStore) return this.buildMongoAuth(store, name);
    if (store instanceof LocalStore) return super.buildAuth(store, name);
    throw new Error(`Unsupported store type '${store.constructor.name}'`);
  }

  private async buildMongoAuth(store: MongoStore, name: string) {
    const db = store.getSessionDb(name);
    const authStore = new NoWebMongoDbAuth(db);
    await authStore.init();
    return authStore.methods();
  }
}
