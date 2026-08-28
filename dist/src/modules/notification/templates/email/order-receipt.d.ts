import type { EmailMessage } from '../../notification.types';
export declare function orderReceiptEmail(orderCode: string, total: number, items: {
    name: string;
    qty: number;
    price: number;
}[]): EmailMessage;
