import type { PushMessage } from '../../notification.types';

// Mapped onto every real order->'failed' transition (allocation exhausted,
// delivery-matching exhausted, vendor rejects pre-accept) — no dedicated
// customer-initiated cancel endpoint exists yet, flagged in CLAUDE.md.
export function orderCancelledCustomerPush(orderCode: string, orderId?: string, type: 'grocery' | 'food' = 'grocery'): PushMessage {
  return {
    title: 'Order cancelled',
    body: `Order ${orderCode} could not be completed and has been cancelled. Any payment will be refunded.`,
    data: {
      event: 'order_cancelled',
      orderCode,
      ...(orderId ? { orderId, type, link: `/order/${orderId}?type=${type}` } : {}),
    },
  };
}

export function orderCancelledVendorPush(orderCode: string, orderId?: string): PushMessage {
  return {
    title: 'Order cancelled',
    body: `Order ${orderCode} was cancelled.`,
    data: {
      event: 'order_cancelled',
      orderCode,
      ...(orderId ? { orderId, link: `/order/${orderId}` } : {}),
    },
  };
}

export function orderCancelledPartnerPush(orderCode: string, orderId?: string): PushMessage {
  return {
    title: 'Assignment cancelled',
    body: `Your assignment for order ${orderCode} was cancelled.`,
    data: {
      event: 'order_cancelled',
      orderCode,
      ...(orderId ? { orderId, link: `/orders` } : {}),
    },
  };
}
