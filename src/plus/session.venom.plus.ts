import { WhatsappSessionVenomCore } from '../core/session.venom.core';
import { create, Message } from 'venom-bot';

export class WhatsappSessionVenomPlus extends WhatsappSessionVenomCore {
  protected buildClient() {
    return create(
      this.name,
      this.getCatchQR(),
      undefined,
      // Keep this options in sync with core
      {
        headless: true,
        devtools: false,
        debug: false,
        logQR: true,
        browserArgs: this.getBrowserArgsForPuppeteer(),
        autoClose: 60000,
        puppeteerOptions: {},
        folderNameToken: this.sessionStorage.engine,
        mkdirFolderToken: this.sessionStorage.sessionsFolder,
      },
    );
  }
  protected async downloadAndDecryptMedia(message: Message) {
    if (!message.isMMS || !message.isMedia) {
      return message;
    }

    this.log.log(`The message ${message.id} has media, downloading it...`);
    return this.whatsapp.decryptFile(message).then(async (buffer) => {
      this.log.verbose(`Writing file from the message ${message.id}...`);
      const url = await this.storage.save(message.id, message.mimetype, buffer);
      this.log.log(`The file from ${message.id} has been saved to ${url}`);

      // @ts-ignore
      message.mediaUrl = url;
      return message;
    });
  }
}
