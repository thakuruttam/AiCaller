import { prisma } from '../db.js';

export async function createNotification({ userId, tenantId, type, title, body, link = null }) {
  try {
    await prisma.notification.create({
      data: { userId, tenantId, type, title, body, link }
    });
  } catch (err) {
    console.error('[notifications] createNotification failed:', err.message);
  }
}

/**
 * Broadcast a notification to every member of a workspace PLUS all SUPER_ADMINs.
 * skipUserId optionally excludes the actor (e.g. the person who triggered the event).
 */
export async function notifyWorkspace({ tenantId, type, title, body, link = null, skipUserId = null }) {
  try {
    const [members, superAdmins] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: { tenantId },
        select: { userId: true }
      }),
      prisma.user.findMany({
        where: { role: 'SUPER_ADMIN' },
        select: { id: true }
      })
    ]);

    // Merge workspace members + super admins, deduplicate by userId
    const seen = new Set();
    const recipients = [];
    for (const m of [...members.map(m => ({ userId: m.userId })), ...superAdmins.map(u => ({ userId: u.id }))]) {
      if (!seen.has(m.userId)) {
        seen.add(m.userId);
        recipients.push(m);
      }
    }

    const data = recipients
      .filter(r => r.userId !== skipUserId)
      .map(r => ({ userId: r.userId, tenantId, type, title, body, link }));

    if (data.length > 0) {
      await prisma.notification.createMany({ data });
    }
  } catch (err) {
    console.error('[notifications] notifyWorkspace failed:', err.message);
  }
}
