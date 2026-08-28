import type { EmailMessage } from '../../notification.types';
export declare function adminBroadcastEmail(params: {
    title: string;
    message: string;
    recipientName?: string;
}): EmailMessage;
