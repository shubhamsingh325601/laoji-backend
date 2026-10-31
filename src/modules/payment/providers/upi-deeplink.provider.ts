import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { inArray } from 'drizzle-orm';
import type { Db } from '../../../config/database.module';
import { DRIZZLE } from '../../../config/database.module';
import { platformSettings } from '../../../../drizzle/schema';
import type {
  PaymentInitiateParams,
  PaymentInitiateResult,
  PaymentProvider,
  PaymentRefundParams,
  PaymentRefundResult,
  PaymentVerifyParams,
  PaymentVerifyResult,
} from '../payment.types';

export const PLATFORM_KEY_CUSTOMER_UPI_VPA = 'customer_upi_vpa';
export const PLATFORM_KEY_CUSTOMER_UPI_PAYEE = 'customer_upi_payee_name';

// The only real implementation at MVP (TRD Section 4). Builds a plain
// upi://pay deep link — no PSP integration, no webhook, so `verify()` is
// honestly unimplementable here: there is no reliable way for this provider
// to know whether the customer actually completed the transfer. That's the
// whole reason the manual-reconciliation admin screen exists (a real MVP
// requirement, not a fallback for an edge case) — PaymentService never
// calls verify() on this provider, only initiate().
@Injectable()
export class UpiDeepLinkProvider implements PaymentProvider {
  constructor(
    private readonly config: ConfigService,
    @Optional() @Inject(DRIZZLE) private readonly db?: Db,
  ) {}

  async initiate({ orderId, amount }: PaymentInitiateParams): Promise<PaymentInitiateResult> {
    let vpa = this.config.get<string>('UPI_VPA') || '8005949152-3@ybl';
    let payeeName = this.config.get<string>('UPI_PAYEE_NAME') || 'Laoji';

    if (this.db) {
      try {
        const rows = await this.db
          .select({ key: platformSettings.key, value: platformSettings.value })
          .from(platformSettings)
          .where(
            inArray(platformSettings.key, [
              PLATFORM_KEY_CUSTOMER_UPI_VPA,
              PLATFORM_KEY_CUSTOMER_UPI_PAYEE,
            ]),
          );
        for (const r of rows) {
          if (r.key === PLATFORM_KEY_CUSTOMER_UPI_VPA && r.value?.trim()) {
            vpa = r.value.trim();
          } else if (r.key === PLATFORM_KEY_CUSTOMER_UPI_PAYEE && r.value?.trim()) {
            payeeName = r.value.trim();
          }
        }
      } catch {
        // Fall back to config values if database query fails
      }
    }

    // Built by hand rather than with URLSearchParams: that writes spaces as "+",
    // which UPI apps show literally ("Laoji+Order+AB12CD34") or reject. There is
    // no `url` return link either: it must be an https URL per the UPI spec and
    // the apps never redirect back to it, so the app reads the result itself.
    const params: Record<string, string> = {
      pa: vpa,
      pn: payeeName,
      am: amount.toFixed(2),
      tr: orderId,
      tn: `Laoji Order ${orderId.slice(0, 8).toUpperCase()}`,
      cu: 'INR',
    };
    const query = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value).replace(/%40/g, '@')}`)
      .join('&');
    return {
      status: 'pending',
      upiDeepLink: `upi://pay?${query}`,
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
