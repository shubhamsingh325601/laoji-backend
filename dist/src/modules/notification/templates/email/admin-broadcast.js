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
  `;
    return {
        subject: params.title,
        html: (0, email_layout_1.wrapInLaojiEmailLayout)(html, params.title),
    };
}
//# sourceMappingURL=admin-broadcast.js.map