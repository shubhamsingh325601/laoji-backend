import type { PushMessage } from '../../notification.types';
export declare function orderConfirmedCustomerPush(orderCode: string, orderId?: string, type?: 'grocery' | 'food'): PushMessage;
