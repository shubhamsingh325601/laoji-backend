import type { PushMessage } from '../../notification.types';

export function orderConfirmedCustomerPush(
  orderCode: string,
  orderId?: string,
  type: 'grocery' | 'food' = 'grocery',
): PushMessage {
  return {
    title: 'Order confirmed',
    body: `Your order ${orderCode} has been confirmed and is being prepared.`,
    data: {
      event: 'order_confirmed',
      orderCode,
      ...(orderId ? { orderId, type, link: `/order/${orderId}?type=${type}` } : {}),
    },
  };
}
