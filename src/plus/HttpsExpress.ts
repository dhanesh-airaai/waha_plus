import * as fs from 'node:fs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const chokidar = require('chokidar');

export class HttpsExpress {
  private readonly keyPath: string;
  private readonly certPath: string;
  private readonly caPath: string;

  constructor() {
    //
    // Let's encrypt certificates default paths
    // cert.pem  chain.pem  fullchain.pem  privkey.pem
    //
    this.keyPath = process.env.WAHA_HTTPS_PATH_KEY || './.secrets/privkey.pem';
    this.certPath = process.env.WAHA_HTTPS_PATH_CERT || './.secrets/cert.pem';
    this.caPath = process.env.WAHA_HTTPS_PATH_CA;
    if (this.caPath == null) {
      this.caPath = './.secrets/chain.pem';
    }
  }

  readSync() {
    console.log('Reading HTTPS certificates...');
    console.log('HTTPS Key Path:', this.keyPath);
    const key = fs.readFileSync(this.keyPath);

    console.log('HTTPS Cert Path:', this.certPath);
    const cert = fs.readFileSync(this.certPath);

    console.log('HTTPS CA Path:', this.caPath);
    const ca = this.caPath ? fs.readFileSync(this.caPath) : undefined;

    console.log('HTTPS certificates read successfully');
    return { key: key, cert: cert, ca: ca };
  }

  /**
   * https://stackoverflow.com/a/74076392
   */
  watchCertChanges(httpd) {
    let waitForCertAndFullChainToGetUpdatedTooTimeout: any;
    const paths = [this.keyPath, this.certPath, this.caPath].filter(
      (path) => !!path,
    );
    const watcher = chokidar.watch(paths, {
      followSymlinks: false,
      persistent: true,
      ignoreInitial: true,
      disableGlobbing: true,
    });
    // IDK why, but it has few bugs:
    // 1. It issues 'add' event at the start, even tho ignoreInitial is set to true
    // 2. It issues additional 'add' for the same file, but without full path
    watcher.on('all', (eventName, path, stats) => {
      console.log(`HTTPS file '${path}' has been '${eventName}'...`);
      clearTimeout(waitForCertAndFullChainToGetUpdatedTooTimeout);
      waitForCertAndFullChainToGetUpdatedTooTimeout = setTimeout(() => {
        console.log('Updating HTTPS configuration...');
        httpd.setSecureContext(this.readSync());
      }, 1000);
    });
  }
}
