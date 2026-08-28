/**
 * Official Laoji branded HTML email template wrapper.
 * Includes top brand banner, customized content area, and official corporate signature.
 */
export function wrapInLaojiEmailLayout(contentHtml: string, previewText = 'Laoji Notification'): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Laoji</title>
</head>
<body style="margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F8F5; color: #1C2320;">
  <div style="display: none; max-height: 0px; overflow: hidden;">${previewText}</div>
  
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #E1E5DE; box-shadow: 0 4px 12px rgba(10, 25, 56, 0.06);">
    
    <!-- Brand Header -->
    <tr>
      <td style="background-color: #0A1938; padding: 28px 32px; text-align: center; border-bottom: 4px solid #D4AF37;">
        <h1 style="color: #D4AF37; margin: 0; font-size: 28px; letter-spacing: 3px; font-weight: 800; font-family: 'Segoe UI', Arial, sans-serif;">LAOJI</h1>
        <p style="color: #E7EEEA; margin: 6px 0 0 0; font-size: 13px; letter-spacing: 0.5px; opacity: 0.9;">Hyperlocal Quick Commerce for Rural & Semi-Urban India</p>
      </td>
    </tr>

    <!-- Body Content Area -->
    <tr>
      <td style="padding: 32px 28px; font-size: 15px; line-height: 1.65; color: #1C2320;">
        ${contentHtml}
      </td>
    </tr>

    <!-- Official Corporate Signature & Footer -->
    <tr>
      <td style="background-color: #F7F8F5; padding: 24px 28px; border-top: 1px solid #E1E5DE;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="vertical-align: top;">
              <p style="margin: 0; font-size: 14px; font-weight: 700; color: #0A1938;">Warm regards,</p>
              <p style="margin: 2px 0 0 0; font-size: 15px; font-weight: 700; color: #1F4B3F;">The Laoji Team</p>
              <p style="margin: 6px 0 0 0; font-size: 12px; color: #64706A;">Laoji Technologies Private Limited</p>
              <p style="margin: 2px 0 0 0; font-size: 12px; color: #64706A;">
                Helpdesk: <a href="mailto:support@laoji.in" style="color: #0A1938; font-weight: 600; text-decoration: none;">support@laoji.in</a> &bull; 
                Web: <a href="https://laoji.in" style="color: #0A1938; font-weight: 600; text-decoration: none;">https://laoji.in</a>
              </p>
            </td>
            <td style="vertical-align: middle; text-align: right; width: 90px;">
              <div style="display: inline-block; padding: 8px 14px; background-color: #0A1938; color: #D4AF37; font-weight: 800; font-size: 13px; border-radius: 8px; letter-spacing: 1.5px; border: 1px solid #D4AF37;">
                LAOJI
              </div>
            </td>
          </tr>
        </table>
        
        <div style="margin-top: 18px; border-top: 1px solid #E2E6DF; padding-top: 12px; text-align: center; font-size: 11px; color: #939C97;">
          Automated system notification &bull; Laoji Platform
        </div>
      </td>
    </tr>

  </table>
</body>
</html>
  `.trim();
}
