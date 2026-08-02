import type { PushMessage } from '../../notification.types';

export function orderConfirmedCustomerPush(orderCode: string): PushMessage {
  return {
    title: 'Order confirmed',
    body: `Your order ${orderCode} has been confirmed and is being prepared.`,
    data: { event: 'order_confirmed', orderCode },
  };
}
