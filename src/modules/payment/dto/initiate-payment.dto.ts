import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export const PAYMENT_METHODS = ['online', 'cod', 'wallet'] as const;

export class InitiatePaymentDto {
  @IsIn(PAYMENT_METHODS)
  method: (typeof PAYMENT_METHODS)[number];

  // Split payment: use the wallet balance first (up to the order total), and
  // pay the rest with `method` (online or cod). The server works out the amount.
  @IsOptional()
  @IsBoolean()
  useWallet?: boolean;
}
