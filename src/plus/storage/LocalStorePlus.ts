import * as path from 'path';

import { LocalStoreCore } from '../../core/storage/LocalStoreCore';

export class LocalStorePlus extends LocalStoreCore {
  protected readonly baseDirectory: string = './.sessions';

  protected getDirectoryPath(name: string): string {
    return path.join(this.getEngineDirectory(), name);
  }
}
