import type { PushMessage } from '../../notification.types';
export declare function orderCancelledCustomerPush(orderCode: string): PushMessage;
export declare function orderCancelledVendorPush(orderCode: string): PushMessage;
export declare function orderCancelledPartnerPush(orderCode: string): PushMessage;
