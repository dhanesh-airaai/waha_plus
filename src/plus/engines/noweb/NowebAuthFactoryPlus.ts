import { join } from 'path';

import { DataStore } from '../../../core/abc/DataStore';
import { NowebAuthFactoryCore } from '../../../core/engines/noweb/NowebAuthFactoryCore';
import { LocalStore } from '../../../core/storage/LocalStore';
import { MongoStore } from '../../storage/MongoStore';
import { makeSureJsonFile } from '../../utils/jsonutils';
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

  protected async buildLocalAuth(store: LocalStore, name: string) {
    // Quick fix for
    // https://github.com/devlikeapro/waha/issues/347
    // We can remove it after some time and the fix
    // https://github.com/WhiskeySockets/Baileys/pull/824
    await this.makeCredsJsonValid(store, name);
    return super.buildLocalAuth(store, name);
  }

  private async makeCredsJsonValid(store: LocalStore, name: string) {
    try {
      await store.init(name);
      const authFolder = store.getSessionDirectory(name);
      const credsPath = join(authFolder, 'creds.json');
      await makeSureJsonFile(credsPath);
    } catch (error) {
      console.error('Failed to fix "creds.json" file, continue...', error);
    }
  }
}
