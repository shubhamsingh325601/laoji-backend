import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  PaymentInitiateParams,
  PaymentInitiateResult,
  PaymentProvider,
  PaymentRefundParams,
  PaymentRefundResult,
  PaymentVerifyParams,
  PaymentVerifyResult,
} from '../payment.types';

// The only real implementation at MVP (TRD Section 4). Builds a plain
// upi://pay deep link — no PSP integration, no webhook, so `verify()` is
// honestly unimplementable here: there is no reliable way for this provider
// to know whether the customer actually completed the transfer. That's the
// whole reason the manual-reconciliation admin screen exists (a real MVP
// requirement, not a fallback for an edge case) — PaymentService never
// calls verify() on this provider, only initiate().
@Injectable()
export class UpiDeepLinkProvider implements PaymentProvider {
  constructor(private readonly config: ConfigService) {}

  async initiate({ orderId, amount }: PaymentInitiateParams): Promise<PaymentInitiateResult> {
    const vpa = this.config.get<string>('UPI_VPA')!;
    const payeeName = this.config.get<string>('UPI_PAYEE_NAME')!;
    const params = new URLSearchParams({
      pa: vpa,
      pn: payeeName,
      am: amount.toFixed(2),
      tr: orderId,
      cu: 'INR',
    });
    return {
      status: 'pending',
      upiDeepLink: `upi://pay?${params.toString()}`,
      providerRef: orderId,
    };
  }

  async verify(_params: PaymentVerifyParams): Promise<PaymentVerifyResult> {
    throw new Error(
      'UpiDeepLinkProvider cannot auto-verify payments — no PSP webhook exists at MVP. Use customer self-confirmation or admin manual reconciliation instead.',
    );
  }

  async refund(_params: PaymentRefundParams): Promise<PaymentRefundResult> {
    throw new Error('UpiDeepLinkProvider cannot issue refunds programmatically — no gateway integration at MVP.');
  }
}
