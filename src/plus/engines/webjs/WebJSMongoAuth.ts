import { sleep } from '@nestjs/terminus/dist/utils';
import * as fs from 'fs';
import { GridFSBucket, GridFSFile } from 'mongodb';
import { Logger } from 'pino';
import { pipeline } from 'stream/promises';
import { Store } from 'whatsapp-web.js';

import { MongoStore } from '../../storage/MongoStore';

class WebJSMongoAuth implements Store {
  private store: MongoStore;
  private logger: Logger;

  constructor(store: MongoStore, logger: Logger) {
    this.store = store;
    this.logger = logger;
  }

  db(session: string) {
    return this.store.getSessionDb(session);
  }

  async sessionExists(options) {
    this.logger.info('Checking if session exists...');
    const session = this.getSessionName(options);
    const filesCollection = this.getFilesCollectionName();
    const multiDeviceCollection = this.db(session).collection(filesCollection);
    const hasExistingSession = await multiDeviceCollection.countDocuments();
    const result = !!hasExistingSession;
    this.logger.info(`Session exists: ${result}`);
    return result;
  }

  async save(options) {
    this.logger.debug('Saving session...');
    const session = this.getSessionName(options);
    const bucketName = this.getBucketName();
    const filename = this.getAuthFileName(options);

    const bucket = new GridFSBucket(this.db(session), {
      bucketName: bucketName,
    });
    const readStream = fs.createReadStream(filename);
    const uploadStream = bucket.openUploadStream(filename);
    await pipeline(readStream, uploadStream);
    this.logger.debug('Session saved.');
    await this.#deletePrevious(options, bucket);
  }

  async extract(options) {
    this.logger.info('Extracting existing session...');
    const session = this.getSessionName(options);
    const bucketName = this.getBucketName();
    const filename = this.getAuthFileName(options);

    const bucket = new GridFSBucket(this.db(session), {
      bucketName: bucketName,
    });
    const downloadStream = bucket.openDownloadStreamByName(filename);
    const writeStream = fs.createWriteStream(options.path);
    await pipeline(downloadStream, writeStream);
    // Wait a second before giving the zip file to next phase
    await sleep(1_000);
    this.logger.info('Session has been extracted.');
  }

  async delete(options) {
    this.logger.debug('Deleting session...');
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
    this.logger.debug('Session deleted.');
  }

  async #deletePrevious(options, bucket) {
    const filename = this.getAuthFileName(options);
    const documents = await bucket
      .find({
        filename: filename,
      })
      .toArray();
    if (documents.length > 1) {
      this.logger.debug('Deleting old auth files...');
      // Got all, but not the last one
      const oldDocuments = documents.slice();
      // Sort by uploadDate, desc
      oldDocuments.sort((a, b) => {
        return a.uploadDate - b.uploadDate;
      });
      const keepDocument = oldDocuments.pop();
      this.logger.debug(
        `Keeping document - '${keepDocument.uploadDate}', '${keepDocument._id}'`,
      );
      oldDocuments.map((document: GridFSFile) => {
        this.logger.debug(
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
