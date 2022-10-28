import {Hooks, WhatsappStatus} from "./enums";
import {ConsoleLogger} from "@nestjs/common";
import {LocalMediaStorage} from "./storage";

type MessageHandlerFunction = {
    message: any
}

export abstract class WhatsappSession {
    public status: WhatsappStatus;
    protected log: ConsoleLogger;

    public constructor(public name: string, protected storage: LocalMediaStorage) {
        this.name = name
        this.status = WhatsappStatus.STARTING
        this.log = new ConsoleLogger()
        this.log.setContext(`WhatsappService - ${this.name}`)
    }

    /**
     * Start the session
     */
    abstract start()

    /**
     * Stop the session
     */
    abstract stop()

    /**
     * Get screenshot
     */
    abstract getScreenshot(): Promise<Buffer | string>

    /**
     * Subscribe the handler to specific hook
     * @param hook
     * @param handler
     */
    abstract subscribe(hook: Hooks | string, handler: (message) => void)

    /**
     * Get actual whatsapp instance
     */
    // TODO: Remove it in order to add more functions
    abstract getWhatsapp()
}


