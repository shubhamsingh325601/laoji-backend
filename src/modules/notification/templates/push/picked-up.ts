import type { PushMessage } from '../../notification.types';

export function pickedUpCustomerPush(orderCode: string, orderId?: string, type: 'grocery' | 'food' = 'grocery'): PushMessage {
  return {
    title: 'Order picked up',
    body: `Order ${orderCode} has been picked up and is on its way.`,
    data: {
      event: 'picked_up',
      orderCode,
      ...(orderId ? { orderId, type, link: `/order/${orderId}?type=${type}` } : {}),
    },
  };
}

export function pickedUpVendorPush(orderCode: string, orderId?: string): PushMessage {
  return {
    title: 'Handover confirmed',
    body: `Order ${orderCode} was picked up by the delivery partner.`,
    data: {
      event: 'picked_up',
      orderCode,
      ...(orderId ? { orderId, link: `/order/${orderId}` } : {}),
    },
  };
}
