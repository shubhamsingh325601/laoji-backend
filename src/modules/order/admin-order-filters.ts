import type { orderStatusEnum } from '../../../drizzle/schema';

type OrderStatusValue = (typeof orderStatusEnum.enumValues)[number];

// The Orders screen filters by the 9 stages it shows, not by the 11 raw
// backend statuses (see mapOrderStatus in laoji-admin's orderAdapter.ts). This
// is the same mapping, so a server-side filter returns exactly the rows the
// old in-browser filter did.
export const ADMIN_ORDER_STATUS_FILTERS = [
  'placed',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'allocation_failed',
] as const;

export type AdminOrderStatusFilter = (typeof ADMIN_ORDER_STATUS_FILTERS)[number];

export function statusesForFilter(filter: AdminOrderStatusFilter, type: 'grocery' | 'food'): OrderStatusValue[] {
  switch (filter) {
    case 'placed':
      return ['placed'];
    case 'accepted':
      return ['vendor_accepted'];
    case 'preparing':
      return ['preparing'];
    case 'ready':
      return ['ready'];
    case 'picked_up':
      return ['handed_over', 'delivery_assigned', 'picked_up'];
    case 'out_for_delivery':
      return ['out_for_delivery'];
    case 'delivered':
      return ['delivered'];
    // A failed food order is a vendor rejection, shown as cancelled. A failed
    // grocery order is allocation running out of vendors.
    case 'cancelled':
      return type === 'grocery' ? ['cancelled'] : ['cancelled', 'failed'];
    case 'allocation_failed':
      return type === 'grocery' ? ['failed'] : [];
  }
}

// The payment dropdown's "COD pending" has always been stored as pending_cod.
export function paymentStatusesForFilter(filter: string): string[] {
  return filter === 'cod_pending' ? ['pending_cod', 'cod_pending'] : [filter];
}

// Admin date pickers are calendar days in India, so a day runs midnight to
// midnight IST rather than UTC.
export function istDayStart(day: string): Date {
  return new Date(`${day}T00:00:00.000+05:30`);
}

export function istDayEnd(day: string): Date {
  return new Date(`${day}T23:59:59.999+05:30`);
}

// Escapes the characters ILIKE treats as wildcards so a typed "50%" or "a_b"
// is searched for literally.
export function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}
