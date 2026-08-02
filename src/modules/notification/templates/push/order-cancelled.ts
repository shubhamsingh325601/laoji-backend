import type { PushMessage } from '../../notification.types';

// Mapped onto every real order->'failed' transition (allocation exhausted,
// delivery-matching exhausted, vendor rejects pre-accept) — no dedicated
// customer-initiated cancel endpoint exists yet, flagged in CLAUDE.md.
export function orderCancelledCustomerPush(orderCode: string): PushMessage {
  return {
    title: 'Order cancelled',
    body: `Order ${orderCode} could not be completed and has been cancelled. Any payment will be refunded.`,
    data: { event: 'order_cancelled', orderCode },
  };
}

export function orderCancelledVendorPush(orderCode: string): PushMessage {
  return {
    title: 'Order cancelled',
    body: `Order ${orderCode} was cancelled.`,
    data: { event: 'order_cancelled', orderCode },
  };
}

export function orderCancelledPartnerPush(orderCode: string): PushMessage {
  return {
    title: 'Assignment cancelled',
    body: `Your assignment for order ${orderCode} was cancelled.`,
    data: { event: 'order_cancelled', orderCode },
  };
}
