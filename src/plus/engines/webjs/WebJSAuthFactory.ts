import { DataStore } from '@waha/core/abc/DataStore';
import { LocalStore } from '@waha/core/storage/LocalStore';
import { RemoteAuth, Zipper } from '@waha/plus/engines/webjs/RemoteAuth';
import { StreamZipper } from '@waha/plus/engines/webjs/StreamZipper';
import { WebJSMongoAuth } from '@waha/plus/engines/webjs/WebJSMongoAuth';
import { ZipUnzipZipper } from '@waha/plus/engines/webjs/ZipUnzipZipper';
import { MongoStore } from '@waha/plus/storage/MongoStore';
import { LoggerBuilder } from '@waha/utils/logging';
import { Logger } from 'pino';
import { AuthStrategy, LocalAuth } from 'whatsapp-web.js';

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
    const zipper = this.getAvailableZipper(logger);
    return new RemoteAuth({
      backupSyncIntervalMs: 60 * 1000,
      clientId: name,
      dataPath: null,
      logger: loggerBuilder.child({ name: RemoteAuth.name }),
      store: authStore,
      zipper: zipper,
    });
  }

  private getAvailableZipper(logger: Logger): Zipper {
    if (process.env.WAHA_ZIPPER == 'ZIPUNZIP') {
      logger.debug('Using ZipUnzipZipper');
      return new ZipUnzipZipper();
    }
    logger.debug('Using StreamZipper');
    return new StreamZipper();
  }
}
