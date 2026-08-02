import type { PushMessage } from '../../notification.types';

export function outForDeliveryCustomerPush(orderCode: string): PushMessage {
  return {
    title: 'Out for delivery',
    body: `Order ${orderCode} is out for delivery — hang tight!`,
    data: { event: 'out_for_delivery', orderCode },
  };
}
