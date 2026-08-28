"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.welcomeCustomerEmail = welcomeCustomerEmail;
const email_layout_1 = require("./email-layout");
function welcomeCustomerEmail(params) {
    const displayName = params.name?.trim() || 'Valued Customer';
    const html = `
    <h2 style="color: #0A1938; margin-top: 0; font-size: 22px;">Welcome to Laoji! 🛍️</h2>
    <p>Dear <strong>${displayName}</strong>,</p>
    <p>We are delighted to welcome you to <strong>Laoji</strong> — your trusted hyperlocal delivery platform for fresh groceries, daily essentials, and mouth-watering meals from your favorite local stores and restaurants.</p>
    
    <div style="background-color: #F0F4EE; border-left: 4px solid #1F4B3F; padding: 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-weight: bold; color: #1F4B3F;">Account Registered</p>
      <p style="margin: 4px 0 0 0; font-size: 14px; color: #3E4B45;">
        Registered Phone: <strong>${params.phone ? '+91 ' + params.phone : 'On File'}</strong><br/>
        Email: <strong>${params.email || 'On File'}</strong>
      </p>
    </div>

    <p>You can start shopping immediately via the Laoji app or web platform. No hidden charges — fast delivery right to your doorstep!</p>
    <p style="margin-top: 24px;">Need help? Our customer care is always available at <a href="mailto:support@laoji.in" style="color: #0A1938; font-weight: 600;">support@laoji.in</a>.</p>
  `;
    return {
        subject: 'Welcome to Laoji! Your account is ready 🛍️',
        html: (0, email_layout_1.wrapInLaojiEmailLayout)(html, 'Welcome to Laoji! Start shopping today.'),
    };
}
//# sourceMappingURL=welcome-customer.js.map