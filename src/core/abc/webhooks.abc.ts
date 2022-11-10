import {WhatsappSession} from "./session.abc";

export abstract class WebhookConductorBase {
    abstract configure(session: WhatsappSession)
}
