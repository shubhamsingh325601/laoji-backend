import type { PushMessage } from '../../notification.types';

export function deliveredCustomerPush(orderCode: string): PushMessage {
  return {
    title: 'Delivered!',
    body: `Order ${orderCode} has been delivered. Enjoying it? Rate your experience.`,
    data: { event: 'delivered', orderCode },
  };
}

export function deliveredVendorPush(orderCode: string): PushMessage {
  return {
    title: 'Order complete',
    body: `Order ${orderCode} was delivered successfully.`,
    data: { event: 'delivered', orderCode },
  };
}

export function deliveredPartnerPush(orderCode: string, payout: number): PushMessage {
  return {
    title: 'Earnings updated',
    body: `You completed order ${orderCode} — ₹${payout} added to your earnings.`,
    data: { event: 'delivered', orderCode },
  };
}
