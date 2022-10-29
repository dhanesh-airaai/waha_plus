import fs = require('fs');
import del = require("del");
import {promisify} from "util";
import {SECOND} from "../structures/enums.dto";
import * as path from "path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mime = require('mime-types');

const writeFileAsync = promisify(fs.writeFile)

export class LocalMediaStorage {
    private readonly lifetime: number;

    constructor(private filesFolder, private baseUrl, private lifetimeSeconds, private mimetypes) {
        this.lifetime = lifetimeSeconds * SECOND

        this.cleanFolder()
    }

    /**
     *  Check that we need to download files with the mimetype
     */
    private needToDownload(mimetype) {
        // No specific mimetypes provided - always download
        if (!this.mimetypes) {
            return true
        }
        // Found "right" mimetype in the list of allowed mimetypes  - download it
        return this.mimetypes.some((type) => mimetype.startsWith(type));

    }

    public async save(messageId, mimetype, buffer): Promise<string> {
        if (!this.needToDownload(mimetype)) {
            console.log(`The message ${messageId} has ${mimetype} media, skip it.`);
            return ""
        }

        const filename = `${messageId}.${mime.extension(mimetype)}`;
        const filepath = path.resolve(`${this.filesFolder}/${filename}`)
        await writeFileAsync(filepath, buffer);
        this.postponeRemoval(filepath)
        return this.baseUrl + filename
    }

    private postponeRemoval(filepath: string) {
        setTimeout(() => fs.unlink(filepath, () => {
            console.log(`File ${filepath} was removed`)
        }), this.lifetime)
    }

    private cleanFolder() {
        if (fs.existsSync(this.filesFolder)) {
            del([`${this.filesFolder}/*`], {force: true}).then((paths) => {
                    if (paths.length === 0) {
                        return
                    }
                    console.log('Deleted files and directories:\n', paths.join('\n'))
                }
            )
        } else {
            fs.mkdirSync(this.filesFolder)
            console.log(`Directory '${this.filesFolder}' created from scratch`)
        }
    }
}
