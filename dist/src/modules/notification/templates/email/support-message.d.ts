import type { EmailMessage } from '../../notification.types';
export declare function supportMessageAdminEmail(params: {
    fromRole: string;
    fromPhone: string | null;
    fromEmail: string | null;
    subject: string;
    message: string;
}): EmailMessage;
