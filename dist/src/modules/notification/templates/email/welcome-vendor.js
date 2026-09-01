"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.welcomeVendorEmail = welcomeVendorEmail;
const email_layout_1 = require("./email-layout");
function welcomeVendorEmail(params) {
    const categoryLabel = params.type === 'restaurant' ? 'Restaurant & Dining' : params.type === 'both' ? 'Kirana & Food' : 'Grocery & Kirana';
    const apkUrl = params.apkDownloadUrl || 'https://laojionline.com/download/vendor.apk';
    const credentialsBlock = params.tempPassword
        ? `
      <div style="background-color: #EEF4FF; border: 1.5px solid #2563EB; padding: 18px; margin: 22px 0; border-radius: 8px;">
        <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 15px; color: #1E40AF;">🔐 Your Vendor App Login Credentials</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 6px 0; color: #475569; width: 140px;"><strong>Login Email:</strong></td>
            <td style="padding: 6px 0; color: #0F172A; font-weight: 600;">${params.email || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #475569;"><strong>Temporary Password:</strong></td>
            <td style="padding: 6px 0;">
              <code style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 15px; font-weight: bold; background-color: #DBEAFE; color: #1E3A8A; padding: 4px 10px; border-radius: 4px; letter-spacing: 0.5px;">${params.tempPassword}</code>
            </td>
          </tr>
        </table>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748B;">
          ⚠️ <em>For security, you will be asked to create your own new password immediately after your first login.</em>
        </p>
      </div>
    `
        : '';
    const html = `
    <h2 style="color: #0A1938; margin-top: 0; font-size: 22px;">Welcome to the Laoji Partner Network! 🏪</h2>
    <p>Dear <strong>${params.ownerName}</strong>,</p>
    <p>Congratulations! Your store <strong>${params.businessName}</strong> has been officially invited to partner with the <strong>Laoji Platform</strong>.</p>
    
    ${credentialsBlock}

    <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 18px; margin: 20px 0; border-radius: 8px;">
      <h3 style="color: #0A1938; font-size: 16px; margin: 0 0 12px 0;">📱 How to Get Started:</h3>
      <ol style="margin: 0; padding-left: 20px; color: #334155; line-height: 1.8; font-size: 14px;">
        <li style="margin-bottom: 8px;">
          <strong>Install the Vendor App (APK):</strong><br/>
          Download the Android app using the button below. If prompted by your device, allow "Install unknown apps" to proceed.
          <div style="margin: 10px 0;">
            <a href="${apkUrl}" style="display: inline-block; background-color: #0A1938; color: #FFFFFF; font-weight: 600; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 13px;">
              📥 Download Laoji Vendor APK
            </a>
          </div>
        </li>
        <li style="margin-bottom: 8px;">
          <strong>Log In with Your Email:</strong><br/>
          Open the app and log in using your <strong>Email ID (${params.email})</strong> and the <strong>Temporary Password</strong> shown above (instead of phone number).
        </li>
        <li style="margin-bottom: 8px;">
          <strong>Create Your New Password:</strong><br/>
          On first login, the app will display the <strong>Create Password</strong> screen. Choose a secure new password for your account.
        </li>
        <li style="margin-bottom: 4px;">
          <strong>Start Managing Your Store:</strong><br/>
          Add your items/menu, configure business hours, toggle your store to <strong>Online</strong>, and start receiving orders!
        </li>
      </ol>
    </div>

    <div style="background-color: #FBF6E9; border-left: 4px solid #D4AF37; padding: 14px 16px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-weight: bold; color: #785A00; font-size: 13px;">Partner Summary</p>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #4A3E20;">
        Store: <strong>${params.businessName}</strong> &bull; Category: <strong>${categoryLabel}</strong> &bull; Contact: <strong>${params.phone ? '+91 ' + params.phone : 'On File'}</strong>
      </p>
    </div>

    <p style="margin-top: 24px; font-size: 14px; color: #475569;">
      Need any assistance? Our partner support team is here to help at <a href="mailto:support@laoji.in" style="color: #0A1938; font-weight: 600;">support@laoji.in</a>.
    </p>
  `;
    return {
        subject: `Welcome to Laoji Partner Network — Your Vendor Account & App Download 🏪`,
        html: (0, email_layout_1.wrapInLaojiEmailLayout)(html, `Welcome to Laoji! Your vendor account credentials and APK download.`),
    };
}
//# sourceMappingURL=welcome-vendor.js.map