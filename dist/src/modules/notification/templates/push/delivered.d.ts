import type { PushMessage } from '../../notification.types';
export declare function deliveredCustomerPush(orderCode: string, orderId?: string, type?: 'grocery' | 'food'): PushMessage;
export declare function deliveredVendorPush(orderCode: string, orderId?: string): PushMessage;
export declare function deliveredPartnerPush(orderCode: string, payout: number, orderId?: string): PushMessage;
