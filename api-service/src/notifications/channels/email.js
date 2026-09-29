import { Resend } from 'resend';
import { renderEmail } from '../templates.js';

// Email channel. Lazily constructs the Resend client so importing this module
// never requires the key to be present — an unconfigured channel simply
// reports itself unavailable and the dispatcher skips it.
let client = null;

function getClient() {
  if (!client && process.env.RESEND_API_KEY) {
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

export const name = 'email';

export function isConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL);
}

export function addressFor(user) {
  return user?.email || null;
}

export async function send({ to, notification, user }) {
  const resend = getClient();
  if (!resend) throw new Error('Resend client unavailable');

  const { subject, text, html } = renderEmail({
    title: notification.title,
    body: notification.body,
    link: notification.link,
    recipientName: user?.name?.split(' ')[0],
  });

  await resend.emails.send({
    from: `${process.env.RESEND_FROM_NAME || 'AI Caller Pro'} <${process.env.RESEND_FROM_EMAIL}>`,
    to,
    subject,
    text,
    html,
  });
}
