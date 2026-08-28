"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportMessageAdminEmail = supportMessageAdminEmail;
function supportMessageAdminEmail(params) {
    return {
        subject: `[Support] ${params.subject}`,
        html: `
      <p><strong>From:</strong> ${params.fromRole} — ${params.fromPhone ?? 'no phone'} / ${params.fromEmail ?? 'no email'}</p>
      <p><strong>Message:</strong></p>
      <p>${params.message.replace(/\n/g, '<br/>')}</p>
    `,
    };
}
//# sourceMappingURL=support-message.js.map