import type { EmailMessage } from '../../notification.types';
import { wrapInLaojiEmailLayout } from './email-layout';

export function welcomePartnerEmail(params: {
  name: string;
  phone?: string;
  email?: string;
  vehicleType?: string;
}): EmailMessage {
  const vehicleLabel = params.vehicleType ? params.vehicleType.toUpperCase() : 'TWO-WHEELER';
  const html = `
    <h2 style="color: #0A1938; margin-top: 0; font-size: 22px;">Welcome to the Laoji Delivery Fleet! 🛵</h2>
    <p>Dear <strong>${params.name}</strong>,</p>
    <p>Welcome aboard! You have been successfully registered as a <strong>Delivery Partner / Rider</strong> with <strong>Laoji</strong>.</p>
    
    <div style="background-color: #E8F4F8; border-left: 4px solid #0A1938; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-weight: bold; color: #0A1938;">Rider Profile Information</p>
      <p style="margin: 4px 0 0 0; font-size: 14px; color: #20354A;">
        Rider Name: <strong>${params.name}</strong><br/>
        Registered Phone: <strong>${params.phone ? '+91 ' + params.phone : 'On File'}</strong><br/>
        Vehicle Type: <strong>${vehicleLabel}</strong>
      </p>
    </div>

    <h3 style="color: #0A1938; font-size: 16px; margin-top: 24px;">How to start earning:</h3>
    <ul style="padding-left: 20px; color: #2D3A34; line-height: 1.8;">
      <li>Open the <strong>Laoji Partner App</strong> and log in with your phone number and OTP.</li>
      <li>Turn on your <strong>Online Duty</strong> switch to start receiving delivery assignments.</li>
      <li>Pick up orders from stores and deliver them safely to customers.</li>
      <li>Upload your Aadhaar card photos from the app profile to withdraw earnings anytime directly to your bank account or UPI ID.</li>
    </ul>

    <p style="margin-top: 24px;">Drive safely and welcome to the team!</p>
  `;

  return {
    subject: 'Welcome to Laoji Delivery Partner Fleet 🛵',
    html: wrapInLaojiEmailLayout(html, 'Welcome to Laoji Delivery Fleet! Start accepting rides.'),
  };
}
