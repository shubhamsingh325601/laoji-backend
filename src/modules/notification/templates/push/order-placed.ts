import type { PushMessage } from '../../notification.types';

export function orderPlacedCustomerPush(orderCode: string, total: number): PushMessage {
  return {
    title: 'Order placed',
    body: `Your order ${orderCode} for ₹${total} has been placed.`,
    data: { event: 'order_placed', orderCode },
  };
}

export function orderPlacedVendorPush(orderCode: string, itemCount: number): PushMessage {
  return {
    title: 'New order',
    body: `New order ${orderCode} with ${itemCount} item(s) — respond soon.`,
    data: { event: 'order_placed', orderCode },
  };
}
