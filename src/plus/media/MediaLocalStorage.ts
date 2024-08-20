import { IMediaStorage } from '@waha/core/media/IMediaStorage';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { Logger } from 'pino';
import { promisify } from 'util';

import { SECOND } from '../../structures/enums.dto';
import fs = require('fs');
import del = require('del');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mime = require('mime-types');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const FileType = require('file-type');
const writeFileAsync = promisify(fs.writeFile);

/**
 * Save files locally using the filesystem
 */
export class MediaLocalStorage implements IMediaStorage {
  private readonly lifetimeMs: number;

  constructor(
    protected log: Logger,
    private filesFolder: string,
    private baseUrl: string,
    lifetimeSeconds: number,
  ) {
    this.lifetimeMs = lifetimeSeconds * SECOND;
    if (this.lifetimeMs === 0) {
      this.log.info('Files lifetime is 0, files will not be removed');
    }
  }

  public async save(messageId, mimetype, buffer): Promise<string> {
    if (!mimetype) {
      mimetype = (await FileType.fromBuffer(buffer)).mime;
    }

    const filename = `${messageId}.${mime.extension(mimetype)}`;
    const folder = path.resolve(this.filesFolder);
    // create directory if not exist
    await fsp.mkdir(folder, { recursive: true });

    const filepath = path.resolve(`${folder}/${filename}`);
    await writeFileAsync(filepath, buffer);
    this.postponeRemoval(filepath);
    return this.baseUrl + filename;
  }

  private postponeRemoval(filepath: string) {
    if (this.lifetimeMs === 0) {
      return;
    }
    setTimeout(
      () =>
        fs.unlink(filepath, () => {
          this.log.info(`File ${filepath} was removed`);
        }),
      this.lifetimeMs,
    );
  }

  purge() {
    if (this.lifetimeMs === 0) {
      this.log.info('No need to purge files with lifetime 0');
      return;
    }
    if (fs.existsSync(this.filesFolder)) {
      del([`${this.filesFolder}/*`], { force: true }).then((paths) => {
        if (paths.length === 0) {
          return;
        }
        this.log.info('Deleted files and directories:\n', paths.join('\n'));
      });
    } else {
      fs.mkdirSync(this.filesFolder);
      this.log.info(`Directory '${this.filesFolder}' created from scratch`);
    }
  }
}
