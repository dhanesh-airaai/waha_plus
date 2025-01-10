export interface Presence {
  From: string;
  Unavailable: boolean;
  LastSeen: string;
}

export enum ChatPresenceState {
  COMPOSING = 'composing',
  PAUSED = 'paused',
}

export enum ChatPresenceMedia {
  TEXT = '',
  AUDIO = 'audio',
}

export interface ChatPresence {
  Chat: string;
  Sender: string;
  IsFromMe: boolean;
  IsGroup: boolean;
  State: ChatPresenceState;
  Media: ChatPresenceMedia;
}
