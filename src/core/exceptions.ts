// TODO: Add real address
const PLUS_VERSION_URL = "https://google.com/"

// TODO: Add more details about the engine - venom / whatsapp-web.js
export class NotImplementedByEngineError extends Error {
    constructor() {
        super("The method is not implemented by the engine.");
    }
}

export class AvailableInPlusVersion extends Error {
    constructor() {
        super(`The feature is available only in Plus version. Check this out: ${PLUS_VERSION_URL}`);
    }
}
