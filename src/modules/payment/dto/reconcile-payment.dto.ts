import { IsIn } from 'class-validator';

export const RECONCILE_STATUSES = ['paid', 'failed'] as const;

export class ReconcilePaymentDto {
  @IsIn(RECONCILE_STATUSES)
  status: (typeof RECONCILE_STATUSES)[number];
}
