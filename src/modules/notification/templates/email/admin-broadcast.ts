import type { EmailMessage } from '../../notification.types';
import { wrapInLaojiEmailLayout } from './email-layout';

export function adminBroadcastEmail(params: {
  title: string;
  message: string;
  recipientName?: string;
}): EmailMessage {
  const html = `
    <h2 style="color: #0A1938; margin-top: 0; font-size: 20px;">${params.title}</h2>
    ${params.recipientName ? `<p>Hello <strong>${params.recipientName}</strong>,</p>` : ''}
    <div style="font-size: 15px; color: #2B3330; line-height: 1.7; margin: 16px 0;">
      ${params.message.replace(/\n/g, '<br/>')}
    </div>
  `;

  return {
    subject: params.title,
    html: wrapInLaojiEmailLayout(html, params.title),
  };
}
