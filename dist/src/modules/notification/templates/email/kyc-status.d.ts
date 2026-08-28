import type { EmailMessage } from '../../notification.types';
export declare function kycApprovedEmail(): EmailMessage;
export declare function kycRejectedEmail(reason?: string): EmailMessage;
