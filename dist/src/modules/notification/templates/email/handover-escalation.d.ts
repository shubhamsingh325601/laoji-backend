import type { EmailMessage } from '../../notification.types';
export interface HandoverEscalationParams {
    orderCode: string;
    orderType: string;
    customerName?: string;
    customerPhone?: string;
    riderName?: string;
    riderPhone?: string;
    address?: string;
    pincode?: string;
    reason?: string;
    reportedAt?: Date;
}
export declare function handoverEscalationEmail(params: HandoverEscalationParams): EmailMessage;
