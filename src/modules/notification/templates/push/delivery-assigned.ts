import type { PushMessage } from '../../notification.types';

// The customer-facing counterpart of ready-for-pickup's assignment push —
// fires once the partner has formally accepted (DeliveryService.accept),
// matching the "Delivery partner assigned" matrix row's Customer cell.
export function deliveryAssignedCustomerPush(orderCode: string): PushMessage {
  return {
    title: 'Delivery partner on the way',
    body: `A delivery partner has been assigned to order ${orderCode}. Track it live in the app.`,
    data: { event: 'delivery_assigned', orderCode },
  };
}
