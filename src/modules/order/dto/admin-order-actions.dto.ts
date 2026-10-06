import { IsIn, IsUUID } from 'class-validator';

// Statuses an admin can put an order into by hand. 'placed' is left out (use
// restore), as are 'cancelled' (use cancel) and 'failed'.
export const ADMIN_SETTABLE_STATUSES = [
  'vendor_accepted',
  'preparing',
  'ready',
  'handed_over',
  'delivery_assigned',
  'picked_up',
  'out_for_delivery',
  'delivered',
] as const;

export class AdminSetStatusDto {
  @IsIn(ADMIN_SETTABLE_STATUSES)
  status: (typeof ADMIN_SETTABLE_STATUSES)[number];
}

export class AdminAssignPartnerDto {
  @IsUUID()
  partnerId: string;
}
