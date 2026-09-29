import { prisma } from '../db.js';
import { channelsFor } from './preferences.js';
import * as email from './channels/email.js';
import * as sms from './channels/sms.js';

// Registry. Adding a channel means dropping a module in ./channels that
// exports { name, isConfigured, addressFor, send } and listing it here —
// nothing else in the app changes.
const CHANNELS = { email, sms };

// Delivery is best-effort and must never break the thing that triggered it:
// a campaign should still start if the SMS provider is down. Every failure is
// logged and swallowed.
async function deliver(channel, { user, notification }) {
  try {
    if (!channel.isConfigured()) return { channel: channel.name, skipped: 'not-configured' };
    const to = channel.addressFor(user);
    if (!to) return { channel: channel.name, skipped: 'no-address' };

    await channel.send({ to, user, notification });
    return { channel: channel.name, sent: true };
  } catch (err) {
    console.error(`[notifications] ${channel.name} delivery failed:`, err.message);
    return { channel: channel.name, error: err.message };
  }
}

async function fanOut(users, notificationsByUserId) {
  await Promise.all(users.map(async (user) => {
    const notification = notificationsByUserId.get(user.id);
    if (!notification) return;

    const wanted = channelsFor(user, notification.type);
    await Promise.all(
      wanted
        .map(name => CHANNELS[name])
        .filter(Boolean)
        .map(channel => deliver(channel, { user, notification }))
    );
  }));
}

/**
 * Record a notification for one user and deliver it on whichever channels
 * their preferences allow. The in-app row is always written; email/SMS are
 * layered on top.
 */
export async function notify({ userId, tenantId, type, title, body, link = null }) {
  const notification = { userId, tenantId, type, title, body, link };
  try {
    await prisma.notification.create({ data: notification });
  } catch (err) {
    console.error('[notifications] createNotification failed:', err.message);
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, phone: true, notifyChannels: true },
    });
    if (user) await fanOut([user], new Map([[userId, notification]]));
  } catch (err) {
    console.error('[notifications] dispatch failed:', err.message);
  }
}

/**
 * Broadcast to every member of a workspace PLUS all SUPER_ADMINs.
 * skipUserId excludes the actor who triggered the event.
 */
export async function notifyWorkspace({ tenantId, type, title, body, link = null, skipUserId = null }) {
  let recipientIds = [];

  try {
    const [members, superAdmins] = await Promise.all([
      prisma.workspaceMember.findMany({ where: { tenantId }, select: { userId: true } }),
      prisma.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { id: true } }),
    ]);

    recipientIds = [...new Set([
      ...members.map(m => m.userId),
      ...superAdmins.map(u => u.id),
    ])].filter(id => id !== skipUserId);

    if (!recipientIds.length) return;

    await prisma.notification.createMany({
      data: recipientIds.map(userId => ({ userId, tenantId, type, title, body, link })),
    });
  } catch (err) {
    console.error('[notifications] notifyWorkspace failed:', err.message);
    return;
  }

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, name: true, email: true, phone: true, notifyChannels: true },
    });
    const byUser = new Map(users.map(u => [u.id, { userId: u.id, tenantId, type, title, body, link }]));
    await fanOut(users, byUser);
  } catch (err) {
    console.error('[notifications] workspace dispatch failed:', err.message);
  }
}

// Which channels are actually usable in this deployment — handy for a health
// check or a settings screen that shouldn't offer SMS when it isn't wired up.
export function availableChannels() {
  return Object.values(CHANNELS)
    .filter(c => c.isConfigured())
    .map(c => c.name);
}
