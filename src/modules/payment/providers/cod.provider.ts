import { Injectable } from '@nestjs/common';
import type {
  PaymentInitiateParams,
  PaymentInitiateResult,
  PaymentProvider,
  PaymentRefundParams,
  PaymentRefundResult,
  PaymentVerifyParams,
  PaymentVerifyResult,
} from '../payment.types';

// Cash on delivery, shaped like a provider so it goes through the same
// PaymentService/PaymentProvider path as everything else rather than being
// special-cased in Order/Checkout code. There's no external transaction to
// initiate or verify — the order is immediately payment-satisfied
// (`pending_cod`), and PaymentService flips it to `collected` itself when
// Delivery's OTP-verify (Phase 5) completes the order, not this provider.
@Injectable()
export class CodProvider implements PaymentProvider {
  async initiate(_params: PaymentInitiateParams): Promise<PaymentInitiateResult> {
    return { status: 'pending_cod' };
  }

  async verify({ currentStatus }: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    return { status: currentStatus };
  }

  async refund(_params: PaymentRefundParams): Promise<PaymentRefundResult> {
    throw new Error('COD has no digital transaction to refund — reversal is a manual/offline process.');
  }
}
