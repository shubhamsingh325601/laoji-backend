import type { PushMessage } from '../../notification.types';
export declare function deliveryAssignedCustomerPush(orderCode: string, orderId?: string, type?: 'grocery' | 'food'): PushMessage;
