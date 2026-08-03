import type { EmailMessage } from '../../notification.types';

// Post-Phase-11 MVP-completion pass (Customer Support). PRD Section 5 scopes
// support as "basic (contact/help)" for MVP, not a ticketing system — this
// is the entire implementation: a customer/vendor/delivery-partner message
// reuses the same Resend integration Phase 7 wired up and lands in every
// admin's inbox, exactly like the allocation-failed-admin alert. No ticket
// table, no admin inbox UI (that's explicitly Phase 2 per the PRD).
export function supportMessageAdminEmail(params: {
  fromRole: string;
  fromPhone: string | null;
  fromEmail: string | null;
  subject: string;
  message: string;
}): EmailMessage {
  return {
    subject: `[Support] ${params.subject}`,
    html: `
      <p><strong>From:</strong> ${params.fromRole} — ${params.fromPhone ?? 'no phone'} / ${params.fromEmail ?? 'no email'}</p>
      <p><strong>Message:</strong></p>
      <p>${params.message.replace(/\n/g, '<br/>')}</p>
    `,
  };
}
