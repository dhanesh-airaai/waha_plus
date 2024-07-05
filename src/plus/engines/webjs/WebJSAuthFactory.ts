import { DataStore } from '@waha/core/abc/DataStore';
import { LocalStore } from '@waha/core/storage/LocalStore';
import { WebJSMongoAuth } from '@waha/plus/engines/webjs/WebJSMongoAuth';
import { MongoStore } from '@waha/plus/storage/MongoStore';
import { LoggerBuilder } from '@waha/utils/logging';
import { AuthStrategy, LocalAuth, RemoteAuth } from 'whatsapp-web.js';

export class WebJSAuthFactory {
  buildAuth(
    store: DataStore,
    name: string,
    loggerBuilder: LoggerBuilder,
  ): AuthStrategy {
    if (store instanceof MongoStore)
      return this.buildMongoAuth(store, name, loggerBuilder);
    if (store instanceof LocalStore) return this.buildLocalAuth(store, name);
    throw new Error(`Unsupported store type '${store.constructor.name}'`);
  }

  buildLocalAuth(store: LocalStore, name: string) {
    return new LocalAuth({
      clientId: name,
      dataPath: store.getSessionDirectory(name),
    });
  }

  private buildMongoAuth(
    store: MongoStore,
    name: string,
    loggerBuilder: LoggerBuilder,
  ) {
    const logger = loggerBuilder.child({ name: WebJSMongoAuth.name });
    const authStore = new WebJSMongoAuth(store, logger);
    return new RemoteAuth({
      clientId: name,
      store: authStore,
      backupSyncIntervalMs: 60 * 1000,
    });
  }
}
