import { renderSms } from '../templates.js';

// SMS channel, on Twilio (already a dependency). Same contract as the email
// channel: lazily constructed, reports itself unavailable when unconfigured.
let client = null;

async function getClient() {
  if (client) return client;
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
  const { default: twilio } = await import('twilio');
  client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return client;
}

export const name = 'sms';

export function isConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_SMS_FROM
  );
}

// Only E.164 numbers are usable; anything else is treated as "no address" so
// the dispatcher skips rather than handing Twilio a value it will reject.
export function addressFor(user) {
  const phone = user?.phone?.trim();
  return phone && /^\+[1-9]\d{6,14}$/.test(phone) ? phone : null;
}

export async function send({ to, notification }) {
  const twilioClient = await getClient();
  if (!twilioClient) throw new Error('Twilio client unavailable');

  await twilioClient.messages.create({
    from: process.env.TWILIO_SMS_FROM,
    to,
    body: renderSms({
      title: notification.title,
      body: notification.body,
      link: notification.link,
    }),
  });
}
