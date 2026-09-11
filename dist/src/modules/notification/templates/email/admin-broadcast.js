"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminBroadcastEmail = adminBroadcastEmail;
const email_layout_1 = require("./email-layout");
function adminBroadcastEmail(params) {
    const html = `
    <h2 style="color: #0A1938; margin-top: 0; font-size: 20px;">${params.title}</h2>
    ${params.recipientName ? `<p>Hello <strong>${params.recipientName}</strong>,</p>` : ''}
    <div style="font-size: 15px; color: #2B3330; line-height: 1.7; margin: 16px 0;">
      ${params.message.replace(/\n/g, '<br/>')}
    </div>
    <div style="margin-top: 24px; padding-top: 14px; border-top: 1px dashed #E1E5DE; font-size: 11px; color: #75837D;">
      <p style="margin: 0;">
        You received this announcement as a registered user of Laoji. If you prefer not to receive announcement emails, you can update your notification preferences in the app or contact <a href="mailto:support@laojionline.com" style="color: #0A1938; text-decoration: underline;">support@laojionline.com</a>.
      </p>
    </div>
  `;
    return {
        subject: params.title,
        html: (0, email_layout_1.wrapInLaojiEmailLayout)(html, params.title),
    };
}
//# sourceMappingURL=admin-broadcast.js.map