import {MediaStorage} from "./abc/storage.abc";
import {DOCS_URL} from "./exceptions";

export class MediaStorageNone implements MediaStorage {
    async save(messageId: string, mimetype: string, buffer: Buffer): Promise<string> {
        return Promise.resolve(`Media attachment's available only in WAHA Plus version. ${DOCS_URL}`)
    }
}
