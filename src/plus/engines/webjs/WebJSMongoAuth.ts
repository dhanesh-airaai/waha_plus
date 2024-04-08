import { ConsoleLogger } from '@nestjs/common';
import * as fs from 'fs';
import { GridFSBucket, GridFSFile } from 'mongodb';
import { Store } from 'whatsapp-web.js';

import { MongoStore } from '../../storage/MongoStore';

class WebJSMongoAuth implements Store {
  private store: MongoStore;
  private log: ConsoleLogger;

  constructor(store: MongoStore, log: ConsoleLogger) {
    this.store = store;
    this.log = log;
  }

  db(session: string) {
    return this.store.getSessionDb(session);
  }

  async sessionExists(options) {
    const session = this.getSessionName(options);
    const filesCollection = this.getFilesCollectionName();
    const multiDeviceCollection = this.db(session).collection(filesCollection);
    const hasExistingSession = await multiDeviceCollection.countDocuments();
    return !!hasExistingSession;
  }

  async save(options) {
    const session = this.getSessionName(options);
    const bucketName = this.getBucketName();
    const filename = this.getAuthFileName(options);

    const bucket = new GridFSBucket(this.db(session), {
      bucketName: bucketName,
    });
    await new Promise((resolve, reject) => {
      fs.createReadStream(filename)
        .pipe(bucket.openUploadStream(filename))
        .on('error', (err) => reject(err))
        .on('close', () => resolve(undefined));
    });
    await this.#deletePrevious(options, bucket);
  }

  async extract(options) {
    const session = this.getSessionName(options);
    const bucketName = this.getBucketName();
    const filename = this.getAuthFileName(options);

    const bucket = new GridFSBucket(this.db(session), {
      bucketName: bucketName,
    });
    return new Promise((resolve, reject) => {
      bucket
        .openDownloadStreamByName(filename)
        .pipe(fs.createWriteStream(options.path))
        .on('error', (err) => reject(err))
        .on('close', () => resolve(undefined));
    });
  }

  async delete(options) {
    const session = this.getSessionName(options);
    const bucketName = this.getBucketName();
    const filename = this.getAuthFileName(options);
    const bucket = new GridFSBucket(this.db(session), {
      bucketName: bucketName,
    });
    const documents = await bucket
      .find({
        filename: filename,
      })
      .toArray();

    documents.map(async (doc) => {
      return bucket.delete(doc._id);
    });
  }

  async #deletePrevious(options, bucket) {
    const filename = this.getAuthFileName(options);
    const documents = await bucket
      .find({
        filename: filename,
      })
      .toArray();
    if (documents.length > 1) {
      this.log.debug('Deleting old auth files...');
      // Got all, but not the last one
      const oldDocuments = documents.slice();
      // Sort by uploadDate, desc
      oldDocuments.sort((a, b) => {
        return a.uploadDate - b.uploadDate;
      });
      const keepDocument = oldDocuments.pop();
      this.log.debug(
        `Keeping document - '${keepDocument.uploadDate}', '${keepDocument._id}'`,
      );
      oldDocuments.map((document: GridFSFile) => {
        this.log.debug(
          `Deleting document - '${document.uploadDate}', '${document._id}'`,
        );
        return bucket.delete(document._id);
      });
    }
  }

  /**
   * Get session name
   */
  private getSessionName(options): string {
    const prefix = 'RemoteAuth';
    if (!options.session || options.session === prefix) {
      return 'default';
    }
    // Remote prefix
    return options.session.replace(`${prefix}-`, '');
  }

  private getBucketName(): string {
    return `auth`;
  }

  private getFilesCollectionName(): string {
    const bucket = this.getBucketName();
    return `${bucket}.files`;
  }

  private getAuthFileName(options): string {
    return `${options.session}.zip`;
  }
}

export { WebJSMongoAuth };
