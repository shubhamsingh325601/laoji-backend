import type { EmailMessage } from '../../notification.types';

// Matrix's "Vendor allocation failed / reallocated" row — the only
// non-"—" cell is Admin's "Alert (ops visibility)". Sent as email to every
// admin user rather than push, since laoji-admin (a web app) has no push
// setup and ops-alert-by-email is the standard pattern for this kind of
// thing anyway.
export function allocationFailedAdminEmail(orderCode: string): EmailMessage {
  return {
    subject: `Allocation failed — order ${orderCode}`,
    html: `<p>Order <strong>${orderCode}</strong> could not be allocated to any vendor after exhausting all reallocation attempts. The order has been marked failed.</p>`,
  };
}
