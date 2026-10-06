import type { PushMessage } from '../../notification.types';
export declare function orderPlacedCustomerPush(orderCode: string, total: number, orderId?: string, type?: 'grocery' | 'food'): PushMessage;
export declare function orderPlacedVendorPush(orderCode: string, itemCount: number, orderId?: string, type?: 'grocery' | 'food'): PushMessage;
export declare function orderPlacedAdminPush(orderCode: string, total: number, type?: 'grocery' | 'food', orderId?: string, customerName?: string): PushMessage;
