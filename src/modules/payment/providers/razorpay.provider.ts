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

// Deliberately unimplemented — Phase 6 only needs to prove the interface
// and the PAYMENT_PROVIDER env-driven selection are real and swappable, not
// build a second working gateway integration (that's an explicit future
// phase, not this one). Selecting PAYMENT_PROVIDER=razorpay today fails
// loudly here rather than silently behaving like UPI deep-link.
@Injectable()
export class RazorpayProvider implements PaymentProvider {
  async initiate(_params: PaymentInitiateParams): Promise<PaymentInitiateResult> {
    throw new Error('RazorpayProvider is not implemented yet — set PAYMENT_PROVIDER=upi_deeplink.');
  }

  async verify(_params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    throw new Error('RazorpayProvider is not implemented yet.');
  }

  async refund(_params: PaymentRefundParams): Promise<PaymentRefundResult> {
    throw new Error('RazorpayProvider is not implemented yet.');
  }
}
