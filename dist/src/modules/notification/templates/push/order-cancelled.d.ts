import type { PushMessage } from '../../notification.types';
export declare function orderCancelledCustomerPush(orderCode: string, orderId?: string, type?: 'grocery' | 'food'): PushMessage;
export declare function orderCancelledVendorPush(orderCode: string, orderId?: string): PushMessage;
export declare function orderCancelledPartnerPush(orderCode: string, orderId?: string): PushMessage;
