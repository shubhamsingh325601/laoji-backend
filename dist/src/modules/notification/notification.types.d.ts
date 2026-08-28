export interface PushMessage {
    title: string;
    body: string;
    data?: Record<string, string>;
}
export interface EmailMessage {
    subject: string;
    html: string;
}
export interface PushSendResult {
    ok: boolean;
    stubbed: boolean;
}
export interface EmailSendResult {
    ok: boolean;
    stubbed: boolean;
}
