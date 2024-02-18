import { create, CreateConfig, Message } from 'venom-bot';

import { WhatsappSessionVenomCore } from '../../../core/engines/venom/session.venom.core';
import { EngineMediaProcessor as CoreEngineMediaProcessor } from '../../../core/engines/venom/session.venom.core';
import { LocalStore } from '../../../core/storage/LocalStore';

export class WhatsappSessionVenomPlus extends WhatsappSessionVenomCore {
  sessionStore: LocalStore;

  protected buildClient() {
    const venomOptions: CreateConfig =
      // Keep this options in sync with core
      {
        headless: true,
        devtools: false,
        debug: false,
        logQR: true,
        browserArgs: this.getBrowserArgsForPuppeteer(),
        autoClose: 60000,
        puppeteerOptions: {},
        folderNameToken: this.engine.toLowerCase(),
        mkdirFolderToken: this.sessionStore.getBaseDirectory(),
      };
    this.addProxyConfig(venomOptions);
    return create(this.name, this.getCatchQR(), undefined, venomOptions);
  }

  protected async downloadMedia(message: Message) {
    const processor = new EngineMediaProcessor(this);
    return this.mediaManager.processMedia(processor, message);
  }
}

class EngineMediaProcessor extends CoreEngineMediaProcessor {
  getMessageId(message: Message): string {
    return message.id;
  }

  getMimetype(message: Message): string {
    return message.mimetype;
  }

  async getMediaBuffer(message: Message): Promise<Buffer> {
    return this.session.whatsapp.decryptFile(message);
  }
}
