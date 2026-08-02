import { IsIn } from 'class-validator';

export const PAYMENT_METHODS = ['online', 'cod'] as const;

export class InitiatePaymentDto {
  @IsIn(PAYMENT_METHODS)
  method: (typeof PAYMENT_METHODS)[number];
}
