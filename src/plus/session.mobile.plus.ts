import { WAHAEngine } from '../structures/enums.dto';
import { WhatsappSessionNoWebPlus } from './session.noweb.plus';

export class WhatsappSessionMobilePlus extends WhatsappSessionNoWebPlus {
  engine = WAHAEngine.MOBILE;
}
