import { HIGH_PRIORITY } from './templates.js';

// Which channels a given notification should go out on, for a given user.
//
// Resolution order, most specific wins:
//   1. user.notifyChannels.types[TYPE]  — explicit per-type channel list
//   2. user.notifyChannels.email / .sms — per-user on/off for a whole channel
//   3. env allow-lists                  — NOTIFY_EMAIL_TYPES / NOTIFY_SMS_TYPES
//   4. built-in defaults                — email for everything, SMS for urgent
//
// In-app is not listed here: it is always written, and is the record of what
// happened. The other channels are delivery on top of it.

function envTypes(varName) {
  const raw = process.env[varName];
  if (!raw) return null;
  if (raw.trim() === '*') return '*';
  return new Set(raw.split(',').map(s => s.trim()).filter(Boolean));
}

function allowedByEnv(varName, type) {
  const set = envTypes(varName);
  if (set === null) return null;      // not configured — fall through to defaults
  if (set === '*') return true;
  return set.has(type);
}

export function channelsFor(user, type) {
  const prefs = (user && typeof user.notifyChannels === 'object' && user.notifyChannels) || {};

  // 1. Explicit per-type override
  const perType = prefs.types?.[type];
  if (Array.isArray(perType)) return perType;

  const out = [];

  for (const channel of ['email', 'sms']) {
    // 2. Whole-channel opt-out beats everything below it
    if (prefs[channel] === false) continue;

    // 3. Env allow-list
    const envAllowed = allowedByEnv(
      channel === 'email' ? 'NOTIFY_EMAIL_TYPES' : 'NOTIFY_SMS_TYPES',
      type
    );
    if (envAllowed !== null) {
      if (envAllowed) out.push(channel);
      continue;
    }

    // 4. Defaults — email always, SMS only when the event is urgent, and only
    //    when the user has explicitly turned SMS on.
    if (channel === 'email') out.push('email');
    else if (prefs.sms === true && HIGH_PRIORITY.has(type)) out.push('sms');
  }

  return out;
}
