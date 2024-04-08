import { AuthStrategy, LocalAuth, RemoteAuth } from 'whatsapp-web.js';

import { DataStore } from '../../../core/abc/DataStore';
import { buildLogger } from '../../../core/manager.core';
import { LocalStore } from '../../../core/storage/LocalStore';
import { getLogLevels } from '../../../helpers';
import { MongoStore } from '../../storage/MongoStore';
import { WebJSMongoAuth } from './WebJSMongoAuth';

export class WebJSAuthFactory {
  buildAuth(store: DataStore, name: string, debug: boolean): AuthStrategy {
    if (store instanceof MongoStore)
      return this.buildMongoAuth(store, name, debug);
    if (store instanceof LocalStore) return this.buildLocalAuth(store, name);
    throw new Error(`Unsupported store type '${store.constructor.name}'`);
  }

  buildLocalAuth(store: LocalStore, name: string) {
    return new LocalAuth({
      clientId: name,
      dataPath: store.getSessionDirectory(name),
    });
  }

  private buildMongoAuth(store: MongoStore, name: string, debug: boolean) {
    const levels = getLogLevels(debug);
    const log = buildLogger(`WebJSMongoAuth - ${name}`, levels);
    const authStore = new WebJSMongoAuth(store, log);
    return new RemoteAuth({
      clientId: name,
      store: authStore,
      backupSyncIntervalMs: 60 * 1000,
    });
  }
}
