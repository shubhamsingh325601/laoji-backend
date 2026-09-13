import type { PushMessage } from '../../notification.types';
export declare function pickedUpCustomerPush(orderCode: string, orderId?: string, type?: 'grocery' | 'food'): PushMessage;
export declare function pickedUpVendorPush(orderCode: string, orderId?: string): PushMessage;
