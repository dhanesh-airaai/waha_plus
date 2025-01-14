import { sleep } from '@nestjs/terminus/dist/utils';
import * as fs from 'fs/promises';
import Knex from 'knex';
import { Logger } from 'pino';
import { Store } from 'whatsapp-web.js';

interface Options {
  session: string;
  path?: string;
}

const Migrations = [
  `CREATE TABLE IF NOT EXISTS files
   (
       id         SERIAL PRIMARY KEY,
       name       TEXT  NOT NULL,
       content    BYTEA NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
  // name is unique constraint
  `CREATE UNIQUE INDEX IF NOT EXISTS files_name_index ON files (name)`,
];

export class WebJSPsqlAuth implements Store {
  constructor(
    private knex: Knex.Knex,
    private logger: Logger,
  ) {}

  async sessionExists(options: Options): Promise<boolean> {
    this.logger.info('Checking if session exists...');
    const filename = this.getAuthFileName(options);
    const result = await this.knex('files').where('name', filename);
    const exists = result.length > 0;
    this.logger.info(`Session exists: ${exists}`);
    return exists;
  }

  async delete(options: Options): Promise<any> {
    this.logger.debug('Deleting session...');
    const filename = this.getAuthFileName(options);
    await this.knex('files').where('name', filename).del();
    this.logger.debug('Session deleted.');
  }

  async save(options: Options): Promise<any> {
    this.logger.debug('Saving session...');
    const filename = this.getAuthFileName(options);
    const content = await fs.readFile(filename);
    const now = new Date().toISOString();
    // Upsert
    await this.knex('files')
      .insert({
        name: filename,
        content: content,
        created_at: now,
      })
      .onConflict('name')
      .merge({
        content: content,
        created_at: now,
      });
    this.logger.debug('Session saved.');
  }

  async extract(options: Options) {
    this.logger.debug('Extracting existing session...');
    const filename = this.getAuthFileName(options);
    const result = await this.knex('files').where('name', filename);
    if (result.length === 0) {
      this.logger.warn('Session does not exist.');
      return;
    }
    const content = result[0].content;
    await fs.writeFile(options.path, content);

    // Wait a second before giving the zip file to next phase
    await sleep(1_000);
    this.logger.info('Session has been extracted.');
  }

  async init() {
    for (const migration of Migrations) {
      await this.knex.raw(migration);
    }
  }

  private getAuthFileName(options: Options): string {
    return `${options.session}.zip`;
  }

  async close() {
    await this.knex.destroy();
  }
}
