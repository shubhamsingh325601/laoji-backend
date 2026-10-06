import type { PushMessage } from '../../notification.types';

export function orderPlacedCustomerPush(
  orderCode: string,
  total: number,
  orderId?: string,
  type: 'grocery' | 'food' = 'grocery',
): PushMessage {
  return {
    title: 'Order placed',
    body: `Your order ${orderCode} for ₹${total} has been placed.`,
    data: {
      event: 'order_placed',
      orderCode,
      ...(orderId ? { orderId, type, link: `/order/${orderId}?type=${type}` } : {}),
    },
  };
}

export function orderPlacedVendorPush(
  orderCode: string,
  itemCount: number,
  orderId?: string,
  type: 'grocery' | 'food' = 'grocery',
): PushMessage {
  return {
    title: 'New order',
    body: `New order ${orderCode} with ${itemCount} item(s) — respond soon.`,
    data: {
      event: 'order_placed',
      orderCode,
      ...(orderId ? { orderId, type, link: `/incoming/${orderId}` } : {}),
    },
  };
}

export function orderPlacedAdminPush(
  orderCode: string,
  total: number,
  type: 'grocery' | 'food' = 'grocery',
  orderId?: string,
  customerName?: string,
): PushMessage {
  const typeLabel = type === 'food' ? 'Food' : 'Grocery';
  const customerPart = customerName ? ` from ${customerName}` : '';
  return {
    title: `🛍️ New ${typeLabel} Order #${orderCode}`,
    body: `New ${typeLabel.toLowerCase()} order${customerPart} for ₹${total} received. Tap to view.`,
    imageUrl: undefined,
    data: {
      event: 'order_placed',
      orderCode,
      total: String(total),
      type,
      ...(orderId ? { orderId, link: `/orders/${orderId}`, url: `/orders/${orderId}` } : {}),
    },
  };
}

