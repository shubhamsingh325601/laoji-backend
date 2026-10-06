import type { PushMessage } from '../../notification.types';

export function outForDeliveryCustomerPush(
  orderCode: string,
  orderId?: string,
  type: 'grocery' | 'food' = 'grocery',
  otp?: string | null,
): PushMessage {
  return {
    title: 'Out for delivery',
    body: otp
      ? `Order ${orderCode} is out for delivery. Share OTP ${otp} with the delivery partner when it arrives.`
      : `Order ${orderCode} is out for delivery — hang tight!`,
    data: {
      event: 'out_for_delivery',
      orderCode,
      ...(orderId ? { orderId, type, link: `/order/${orderId}?type=${type}` } : {}),
    },
  };
}
