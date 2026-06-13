import { Resend } from 'resend';

let resend = null;

function getClient() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

export function isEmailConfigured() {
  return !!(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export async function sendInviteEmail({ toEmail, inviterName, workspaceName, role, inviteUrl, expiresAt }) {
  const client = getClient();
  if (!client || !process.env.RESEND_FROM_EMAIL) {
    console.warn('[email] Resend not configured — skipping invite email. Set RESEND_API_KEY and RESEND_FROM_EMAIL.');
    return;
  }

  const expiryFormatted = new Date(expiresAt).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const roleLabel = role.charAt(0) + role.slice(1).toLowerCase();

  await client.emails.send({
    from: `${process.env.RESEND_FROM_NAME || 'AI Caller Pro'} <${process.env.RESEND_FROM_EMAIL}>`,
    to: toEmail,
    subject: `You've been invited to join ${workspaceName} on AI Caller Pro`,
    text: [
      `Hi there,`,
      ``,
      `${inviterName} has invited you to join "${workspaceName}" on AI Caller Pro as ${roleLabel}.`,
      ``,
      `Accept your invitation:`,
      inviteUrl,
      ``,
      `This invite expires on ${expiryFormatted}.`,
      ``,
      `If you don't have an account yet, sign up with Google when you click the link.`,
      `If you weren't expecting this, you can safely ignore this email.`,
      ``,
      `— The AI Caller Pro Team`
    ].join('\n'),
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f2ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f2ff;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08)">

        <tr>
          <td style="background:#3525cd;padding:28px 40px;text-align:center">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px">AI Caller Pro</p>
            <p style="margin:4px 0 0;font-size:11px;color:rgba(255,255,255,0.65);letter-spacing:2px;text-transform:uppercase;font-family:monospace">Enterprise Operations</p>
          </td>
        </tr>

        <tr>
          <td style="padding:40px">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1b1b24">You're invited!</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#464555;line-height:1.6">
              <strong>${inviterName}</strong> has invited you to join
              <strong>${workspaceName}</strong> as <strong>${roleLabel}</strong>.
            </p>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px">
              <tr>
                <td style="background:#e2dfff;border:1px solid rgba(53,37,205,0.2);border-radius:20px;padding:6px 16px">
                  <span style="font-size:12px;font-weight:700;color:#3525cd">${role}</span>
                </td>
                <td style="padding-left:10px">
                  <span style="font-size:13px;color:#777587">in <strong style="color:#1b1b24">${workspaceName}</strong></span>
                </td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px">
              <tr>
                <td style="background:#3525cd;border-radius:12px">
                  <a href="${inviteUrl}" style="display:block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">
                    Accept Invitation →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 8px;font-size:13px;color:#777587">Or paste this link in your browser:</p>
            <p style="margin:0 0 24px;font-size:12px;color:#3525cd;word-break:break-all;font-family:monospace;background:#f5f2ff;padding:10px 14px;border-radius:8px">${inviteUrl}</p>

            <p style="margin:0;font-size:13px;color:#a0a0b0">Expires <strong style="color:#464555">${expiryFormatted}</strong>. If you weren't expecting this, ignore this email.</p>
          </td>
        </tr>

        <tr>
          <td style="background:#f5f2ff;padding:20px 40px;text-align:center;border-top:1px solid #e4e1ee">
            <p style="margin:0;font-size:12px;color:#a0a0b0">AI Caller Pro · Enterprise Operations Platform</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
  });
}
