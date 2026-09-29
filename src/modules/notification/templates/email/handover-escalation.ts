import type { EmailMessage } from '../../notification.types';
import { wrapInLaojiEmailLayout } from './email-layout';

export interface HandoverEscalationParams {
  orderCode: string;
  orderType: string;
  customerName?: string;
  customerPhone?: string;
  riderName?: string;
  riderPhone?: string;
  address?: string;
  pincode?: string;
  reason?: string;
  reportedAt?: Date;
}

export function handoverEscalationEmail(params: HandoverEscalationParams): EmailMessage {
  const reportedTime = (params.reportedAt || new Date()).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const html = `
    <div style="border-left: 4px solid #DC2626; padding-left: 16px; margin-bottom: 24px;">
      <h2 style="color: #991B1B; margin: 0 0 6px 0; font-size: 20px;">⚠️ URGENT: Order Handover Escalation</h2>
      <p style="margin: 0; color: #64748B; font-size: 14px;">A delivery partner was unable to hand over the order to the customer.</p>
    </div>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
      <tr style="background-color: #FEF2F2; border-bottom: 1px solid #FEE2E2;">
        <td style="padding: 10px 14px; font-weight: 700; color: #991B1B; width: 140px;">Order Code:</td>
        <td style="padding: 10px 14px; font-weight: 700; color: #1E293B;">${params.orderCode} (${params.orderType.toUpperCase()})</td>
      </tr>
      <tr style="border-bottom: 1px solid #F1F5F9;">
        <td style="padding: 10px 14px; color: #64748B;">Escalation Reason:</td>
        <td style="padding: 10px 14px; color: #DC2626; font-weight: 600;">${params.reason || 'Customer not reachable / Handover incomplete'}</td>
      </tr>
      <tr style="border-bottom: 1px solid #F1F5F9;">
        <td style="padding: 10px 14px; color: #64748B;">Pincode / Area:</td>
        <td style="padding: 10px 14px; color: #1E293B; font-weight: 600;">${params.pincode || '325601'}</td>
      </tr>
      <tr style="border-bottom: 1px solid #F1F5F9;">
        <td style="padding: 10px 14px; color: #64748B;">Delivery Address:</td>
        <td style="padding: 10px 14px; color: #1E293B;">${params.address || 'Address on file'}</td>
      </tr>
      <tr style="border-bottom: 1px solid #F1F5F9;">
        <td style="padding: 10px 14px; color: #64748B;">Customer Details:</td>
        <td style="padding: 10px 14px; color: #1E293B;">
          <strong>${params.customerName || 'Customer'}</strong> &bull; <a href="tel:${params.customerPhone || ''}" style="color: #0284C7;">${params.customerPhone || 'No phone'}</a>
        </td>
      </tr>
      <tr style="border-bottom: 1px solid #F1F5F9;">
        <td style="padding: 10px 14px; color: #64748B;">Rider Details:</td>
        <td style="padding: 10px 14px; color: #1E293B;">
          <strong>${params.riderName || 'Rider'}</strong> &bull; <a href="tel:${params.riderPhone || ''}" style="color: #0284C7;">${params.riderPhone || 'No phone'}</a>
        </td>
      </tr>
      <tr style="border-bottom: 1px solid #F1F5F9;">
        <td style="padding: 10px 14px; color: #64748B;">Reported At:</td>
        <td style="padding: 10px 14px; color: #1E293B;">${reportedTime} (IST)</td>
      </tr>
    </table>

    <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 14px; font-size: 13px; color: #92400E;">
      <strong>Action Required:</strong> As the assigned Area Manager for this pincode, please contact the customer and delivery partner immediately to resolve the delivery or initiate proper order resolution in accordance with SOP.
    </div>
  `;

  return {
    subject: `🚨 [ESCALATION] Delivery Handover Incomplete — Order #${params.orderCode}`,
    html: wrapInLaojiEmailLayout(html, `Delivery Handover Escalation for Order #${params.orderCode}`),
  };
}
