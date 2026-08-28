import type { PushMessage } from '../../notification.types';
export declare function deliveredCustomerPush(orderCode: string): PushMessage;
export declare function deliveredVendorPush(orderCode: string): PushMessage;
export declare function deliveredPartnerPush(orderCode: string, payout: number): PushMessage;
