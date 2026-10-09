export interface PushMessage {
  title: string;
  body: string;
  imageUrl?: string;
  data?: Record<string, string>;
}

export interface PushSendOptions {
  // Id of the custom sound this device picked (see notification-sound.ts). Null/absent = default channel.
  androidSound?: string | null;
}

export interface EmailMessage {
  subject: string;
  html: string;
}

export interface PushSendResult {
  ok: boolean;
  stubbed: boolean;
  error?: string;
  // The device token is permanently dead (app uninstalled / token rotated) —
  // the caller should drop it so it stops shadowing a live one.
  invalidToken?: boolean;
}

export interface EmailSendResult {
  ok: boolean;
  stubbed: boolean;
  error?: string;
}
