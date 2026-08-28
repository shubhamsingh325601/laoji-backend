import type { EmailMessage } from '../../notification.types';
import { wrapInLaojiEmailLayout } from './email-layout';

export function welcomeVendorEmail(params: {
  businessName: string;
  ownerName: string;
  phone?: string;
  email?: string;
  type?: string;
}): EmailMessage {
  const categoryLabel = params.type === 'restaurant' ? 'Restaurant & Dining' : params.type === 'both' ? 'Kirana & Food' : 'Grocery & Kirana';
  const html = `
    <h2 style="color: #0A1938; margin-top: 0; font-size: 22px;">Welcome to the Laoji Partner Network! 🏪</h2>
    <p>Dear <strong>${params.ownerName}</strong>,</p>
    <p>Congratulations! Your business <strong>${params.businessName}</strong> is now registered as an official store partner on the <strong>Laoji Platform</strong>.</p>
    
    <div style="background-color: #FBF6E9; border-left: 4px solid #D4AF37; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-weight: bold; color: #785A00;">Partner Account Details</p>
      <p style="margin: 4px 0 0 0; font-size: 14px; color: #4A3E20;">
        Store Name: <strong>${params.businessName}</strong><br/>
        Category: <strong>${categoryLabel}</strong><br/>
        Registered Mobile: <strong>${params.phone ? '+91 ' + params.phone : 'On File'}</strong><br/>
        Email: <strong>${params.email || 'On File'}</strong>
      </p>
    </div>

    <h3 style="color: #0A1938; font-size: 16px; margin-top: 24px;">Next Steps to Start Receiving Orders:</h3>
    <ol style="padding-left: 20px; color: #2D3A34; line-height: 1.8;">
      <li>Log in to the <strong>Laoji Vendor App</strong> using your registered phone number.</li>
      <li>Add your products, menu items, and inventory.</li>
      <li>Set your store business hours and toggle availability to <strong>Online</strong>.</li>
      <li>Upload your Aadhaar card (front & back) whenever you wish to withdraw earnings directly to your bank account or UPI!</li>
    </ol>

    <p style="margin-top: 24px;">We are excited to help grow your business! For any vendor support, contact us at <a href="mailto:support@laoji.in" style="color: #0A1938; font-weight: 600;">support@laoji.in</a>.</p>
  `;

  return {
    subject: `Welcome to Laoji Partner Network — ${params.businessName} 🏪`,
    html: wrapInLaojiEmailLayout(html, `Welcome to Laoji Partner Network! Your store is onboarded.`),
  };
}
