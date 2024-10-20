import * as path from 'path';

import { LocalStoreCore } from '../../core/storage/LocalStoreCore';

export class LocalStorePlus extends LocalStoreCore {
  protected readonly baseDirectory: string =
    process.env.WAHA_LOCAL_STORE_BASE_DIR || './.sessions';

  protected getDirectoryPath(name: string): string {
    return path.join(this.getEngineDirectory(), name);
  }
}
