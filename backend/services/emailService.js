const nodemailer = require('nodemailer');

/**
 * backend/services/emailService.js
 *
 * Supports three email providers via .env:
 *
 * Option A — GoDaddy / Microsoft Exchange (your current setup):
 *   EMAIL_HOST=smtp.office365.com
 *   EMAIL_PORT=587
 *   EMAIL_USER=info@marqland.com
 *   EMAIL_PASS=your_password
 *   EMAIL_FROM=Marqland Portal <info@marqland.com>
 *
 * Option B — Gmail:
 *   EMAIL_SERVICE=gmail
 *   EMAIL_USER=you@gmail.com
 *   EMAIL_PASS=your_16_char_app_password
 *
 * Option C — Any other SMTP:
 *   EMAIL_HOST=your.smtp.host
 *   EMAIL_PORT=587
 *   EMAIL_USER=...
 *   EMAIL_PASS=...
 */

const createTransporter = () => {
  // Gmail shortcut
  if (process.env.EMAIL_SERVICE === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  const host = process.env.EMAIL_HOST || 'smtp.office365.com';
  const port = parseInt(process.env.EMAIL_PORT || '587', 10);

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,   // true only for SSL port 465
    requireTLS: true,       // force STARTTLS on port 587 — required by Exchange
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false, // allows self-signed certs on corporate servers
    },
  });
};

/**
 * Test SMTP connection — call on server startup to catch misconfig early.
 * Logs a warning but does NOT crash the server if email is unavailable.
 */
const verifyEmailConfig = async () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️  Email not configured — EMAIL_USER or EMAIL_PASS missing. Invite emails will fail.');
    return false;
  }
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log(`✅ Email configured — ${process.env.EMAIL_USER} via ${process.env.EMAIL_HOST || 'smtp.office365.com'}`);
    return true;
  } catch (err) {
    console.warn(`⚠️  Email connection failed: ${err.message}`);
    console.warn('   Check EMAIL_HOST, EMAIL_USER, EMAIL_PASS in your .env');
    return false;
  }
};

/**
 * Send employee invite email.
 */
const sendInviteEmail = async (toEmail, inviteToken, inviterName = 'The Marqland Admin') => {
  const transporter = createTransporter();
  const appUrl      = process.env.APP_URL || 'http://localhost:3000';
  const inviteLink  = `${appUrl}/#/invite?token=${inviteToken}`;

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || `Marqland Portal <${process.env.EMAIL_USER}>`,
    to:      toEmail,
    subject: `You've been invited to Marqland Internal Portal`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:#0f172a;padding:32px 40px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="background:#6366f1;width:36px;height:36px;border-radius:8px;text-align:center;vertical-align:middle;">
                <span style="color:#fff;font-size:18px;font-weight:900;">▦</span>
              </td>
              <td style="padding-left:12px;color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.02em;text-transform:uppercase;">Marqland</td>
            </tr></table>
          </td>
        </tr>

        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1e293b;">You're invited! 🎉</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              <strong>${inviterName}</strong> has invited you to join the <strong>Marqland Internal Portal</strong>.
              Click the button below to set up your account.
            </p>

            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#6366f1;border-radius:10px;">
                  <a href="${inviteLink}" style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;font-size:15px;font-weight:700;">
                    Create My Account →
                  </a>
                </td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0" style="background:#fefce8;border:1px solid #fde047;border-radius:8px;margin-bottom:24px;width:100%;">
              <tr>
                <td style="padding:12px 16px;font-size:13px;color:#854d0e;">
                  ⏰ <strong>This link expires in 48 hours.</strong> After registering, an admin will activate your account.
                </td>
              </tr>
            </table>

            <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">
              If the button doesn't work, copy this link:<br/>
              <a href="${inviteLink}" style="color:#6366f1;word-break:break-all;">${inviteLink}</a>
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              Sent by ${inviterName} via Marqland Internal Portal. If unexpected, ignore this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
};

/**
 * Send password reset email.
 */
const sendPasswordResetEmail = async (toEmail, resetToken, userName = 'there') => {
  const transporter = createTransporter();
  const appUrl      = process.env.APP_URL || 'http://localhost:3000';
  const resetLink   = `${appUrl}/#/?reset=${resetToken}`;

  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || `Marqland Portal <${process.env.EMAIL_USER}>`,
    to:      toEmail,
    subject: 'Reset your Marqland Portal password',
    html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:#0f172a;padding:32px 40px;">
            <table cellpadding="0" cellspacing="0"><tr>
              <td style="background:#6366f1;width:36px;height:36px;border-radius:8px;text-align:center;vertical-align:middle;">
                <span style="color:#fff;font-size:18px;font-weight:900;">▦</span>
              </td>
              <td style="padding-left:12px;color:#fff;font-size:20px;font-weight:800;text-transform:uppercase;">Marqland</td>
            </tr></table>
          </td>
        </tr>

        <tr>
          <td style="padding:40px 40px 32px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1e293b;">Reset your password</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#64748b;line-height:1.6;">
              Hi ${userName}, click below to set a new password.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
              <tr>
                <td style="background:#6366f1;border-radius:10px;">
                  <a href="${resetLink}" style="display:inline-block;padding:14px 32px;color:#fff;text-decoration:none;font-size:15px;font-weight:700;">
                    Reset Password →
                  </a>
                </td>
              </tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="background:#fefce8;border:1px solid #fde047;border-radius:8px;margin-bottom:24px;width:100%;">
              <tr>
                <td style="padding:12px 16px;font-size:13px;color:#854d0e;">
                  ⏰ <strong>This link expires in 1 hour.</strong> If you didn't request this, ignore this email.
                </td>
              </tr>
            </table>
            <p style="font-size:12px;color:#94a3b8;margin:0;">
              Or copy: <a href="${resetLink}" style="color:#6366f1;word-break:break-all;">${resetLink}</a>
            </p>
          </td>
        </tr>

        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">Marqland Internal Portal.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
};

module.exports = { sendInviteEmail, sendPasswordResetEmail, verifyEmailConfig };