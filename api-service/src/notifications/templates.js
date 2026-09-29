// Rendering for the out-of-app channels. Each notification already carries a
// title and body for the in-app feed; these turn that into an email and an SMS
// without every call site having to know about either format.

const APP_URL = () => process.env.FRONTEND_URL || 'https://aicaller.store';

// Types considered urgent enough to be worth a text message by default.
// Everything else is email-only unless a user opts in.
export const HIGH_PRIORITY = new Set([
  'CALL_FAILED',
  'BALANCE_LOW',
  'BALANCE_DEPLETED',
  'CAMPAIGN_KILLED',
  'SUPPORT_TICKET_REPLIED',
]);

function absoluteLink(link) {
  if (!link) return null;
  return /^https?:\/\//i.test(link) ? link : `${APP_URL()}${link}`;
}

export function renderEmail({ title, body, link, recipientName }) {
  const url = absoluteLink(link);
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi there,';

  const text = [
    greeting,
    '',
    title,
    '',
    body,
    ...(url ? ['', url] : []),
    '',
    '— AI Caller Pro',
    `Manage your notification preferences: ${APP_URL()}/notifications`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4e7ec;border-radius:12px;overflow:hidden">
        <tr>
          <td style="background:#266df0;padding:24px 40px">
            <p style="margin:0;font-size:18px;font-weight:600;color:#ffffff;letter-spacing:-0.02em">AI Caller Pro</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px">
            <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#1c1d1f;letter-spacing:-0.02em">${escapeHtml(title)}</h1>
            <p style="margin:0 0 24px;font-size:15px;color:#505967;line-height:1.55">${escapeHtml(body)}</p>
            ${url ? `<table cellpadding="0" cellspacing="0"><tr><td style="background:#266df0;border-radius:8px">
              <a href="${url}" style="display:block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">View in AI Caller Pro →</a>
            </td></tr></table>` : ''}
          </td>
        </tr>
        <tr>
          <td style="background:#f3f4f6;padding:18px 40px;border-top:1px solid #e4e7ec">
            <p style="margin:0;font-size:12px;color:#8f99a8">
              You're receiving this because of your notification settings.
              <a href="${APP_URL()}/notifications" style="color:#266df0;text-decoration:none">Manage preferences</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject: title, text, html };
}

// SMS is billed per segment, so keep it to one: a short line plus the link.
export function renderSms({ title, body, link }) {
  const url = absoluteLink(link);
  const head = `AI Caller Pro: ${title}`;
  const room = 300 - head.length - (url ? url.length + 1 : 0);
  const detail = room > 20 && body ? ` ${body.slice(0, room).trim()}` : '';
  return `${head}${detail}${url ? ` ${url}` : ''}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}
