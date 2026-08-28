import type { EmailMessage } from '../../notification.types';
export declare function welcomeCustomerEmail(params: {
    name?: string;
    phone?: string;
    email?: string;
}): EmailMessage;
