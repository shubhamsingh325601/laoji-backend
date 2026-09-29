import type { PushMessage } from '../../notification.types';

export function deliveredCustomerPush(orderCode: string, orderId?: string, type: 'grocery' | 'food' = 'grocery'): PushMessage {
  return {
    title: 'Delivered!',
    body: `Order ${orderCode} has been delivered. Enjoying it? Rate your experience.`,
    data: {
      event: 'delivered',
      orderCode,
      ...(orderId ? { orderId, type, link: `/order/${orderId}?type=${type}` } : {}),
    },
  };
}

export function deliveredVendorPush(orderCode: string, orderId?: string): PushMessage {
  return {
    title: 'Order complete',
    body: `Order ${orderCode} was delivered successfully.`,
    data: {
      event: 'delivered',
      orderCode,
      ...(orderId ? { orderId, link: `/order/${orderId}` } : {}),
    },
  };
}

export function deliveredPartnerPush(orderCode: string, payout: number, orderId?: string): PushMessage {
  return {
    title: 'Earnings updated',
    body: `You completed order ${orderCode} — ₹${payout} added to your earnings.`,
    data: {
      event: 'delivered',
      orderCode,
      ...(orderId ? { orderId, link: `/earnings` } : {}),
    },
  };
}
