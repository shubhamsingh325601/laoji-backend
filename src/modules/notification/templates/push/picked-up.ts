import type { PushMessage } from '../../notification.types';

export function pickedUpCustomerPush(orderCode: string): PushMessage {
  return {
    title: 'Order picked up',
    body: `Order ${orderCode} has been picked up and is on its way.`,
    data: { event: 'picked_up', orderCode },
  };
}

export function pickedUpVendorPush(orderCode: string): PushMessage {
  return {
    title: 'Handover confirmed',
    body: `Order ${orderCode} was picked up by the delivery partner.`,
    data: { event: 'picked_up', orderCode },
  };
}
