import type { PushMessage } from '../../notification.types';

// PRD Notification Matrix's "Order ready for pickup" row — the Delivery
// Partner cell ("Assignment push") fires when DeliveryService offers a
// pending assignment to the nearest online partner (Phase 5), not when the
// vendor marks the order ready itself (that's the vendor's own app state).
export function assignmentOfferedPartnerPush(orderCode: string, payout: number): PushMessage {
  return {
    title: 'New delivery assignment',
    body: `Order ${orderCode} is ready for pickup — ₹${payout} payout.`,
    data: { event: 'assignment_offered', orderCode },
  };
}
