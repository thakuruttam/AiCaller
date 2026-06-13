import { prisma } from '../db.js';

const LIMIT = 10;

function baseWhere(user) {
  // SUPER_ADMIN sees all their notifications regardless of workspace
  if (user.role === 'SUPER_ADMIN') {
    return { userId: user.id };
  }
  return { userId: user.id, tenantId: user.workspaceId };
}

export async function listNotifications(req, res) {
  try {
    const notifications = await prisma.notification.findMany({
      where: baseWhere(req.user),
      orderBy: { createdAt: 'desc' },
      take: LIMIT
    });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function getUnreadCount(req, res) {
  try {
    const count = await prisma.notification.count({
      where: { ...baseWhere(req.user), isRead: false }
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function markRead(req, res) {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function markAllRead(req, res) {
  try {
    await prisma.notification.updateMany({
      where: { ...baseWhere(req.user), isRead: false },
      data: { isRead: true }
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
