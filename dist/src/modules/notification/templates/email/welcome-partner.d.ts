import type { EmailMessage } from '../../notification.types';
export declare function welcomePartnerEmail(params: {
    name: string;
    phone?: string;
    email?: string;
    vehicleType?: string;
}): EmailMessage;
