import type { EmailMessage } from '../../notification.types';

export function kycApprovedEmail(): EmailMessage {
  return {
    subject: 'Your Laoji KYC has been approved',
    html: `<p>Good news — your KYC documents have been reviewed and approved. Your account is now fully verified and active on Laoji.</p>`,
  };
}

export function kycRejectedEmail(reason?: string): EmailMessage {
  return {
    subject: 'Your Laoji KYC needs attention',
    html: `<p>One or more of your KYC documents were not approved${reason ? `: <strong>${reason}</strong>` : '.'}</p><p>Please re-upload clear documents from the app to continue.</p>`,
  };
}
