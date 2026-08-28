import type { PushMessage } from '../../notification.types';
export declare function orderPlacedCustomerPush(orderCode: string, total: number): PushMessage;
export declare function orderPlacedVendorPush(orderCode: string, itemCount: number): PushMessage;
