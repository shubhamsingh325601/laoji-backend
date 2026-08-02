import type { EmailMessage } from '../../notification.types';

// Template-only — weekly vendor/delivery-partner settlement computation
// doesn't exist yet (Phase 8: Revenue/Settlement). Written now so the
// template exists per TRD Section 7's list, but nothing schedules or calls
// this until real settlement numbers exist to put in it.
export function settlementSummaryEmail(periodLabel: string, gross: number, commission: number, net: number): EmailMessage {
  return {
    subject: `Your Laoji settlement — ${periodLabel}`,
    html: `<p>Gross: ₹${gross}</p><p>Platform commission: ₹${commission}</p><p><strong>Net payout: ₹${net}</strong></p>`,
  };
}
