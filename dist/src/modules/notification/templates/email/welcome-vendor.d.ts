import type { EmailMessage } from '../../notification.types';
export declare function welcomeVendorEmail(params: {
    businessName: string;
    ownerName: string;
    phone?: string;
    email?: string;
    type?: string;
}): EmailMessage;
