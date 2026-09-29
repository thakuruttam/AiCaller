import { prisma } from '../db.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function baseWhere(user) {
  // SUPER_ADMIN sees all their notifications regardless of workspace
  if (user.role === 'SUPER_ADMIN') {
    return { userId: user.id };
  }
  return { userId: user.id, tenantId: user.workspaceId };
}

// Turns the page's query string into a Prisma filter. `status` narrows by read
// state, `type` accepts a comma-separated list, and `q` matches title or body.
function listWhere(user, { status, type, q }) {
  const where = { ...baseWhere(user) };

  if (status === 'unread') where.isRead = false;
  else if (status === 'read') where.isRead = true;

  const types = String(type || '').split(',').map(t => t.trim()).filter(Boolean);
  if (types.length) where.type = { in: types };

  const term = String(q || '').trim();
  if (term) {
    where.OR = [
      { title: { contains: term, mode: 'insensitive' } },
      { body:  { contains: term, mode: 'insensitive' } },
    ];
  }

  return where;
}

export async function listNotifications(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_LIMIT));
    const where = listWhere(req.user, req.query);
    const scope = baseWhere(req.user);

    const [items, total, all, unread] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: scope }),
      prisma.notification.count({ where: { ...scope, isRead: false } }),
    ]);

    res.json({
      items,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      // Counts describe the whole scope, not the filtered slice, so the filter
      // tabs can show totals without re-querying per tab.
      counts: { all, unread, read: all - unread },
    });
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
    const { count } = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: true }
    });
    if (!count) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function markUnread(req, res) {
  try {
    const { count } = await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isRead: false }
    });
    if (!count) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function markAllRead(req, res) {
  try {
    const { count } = await prisma.notification.updateMany({
      where: { ...baseWhere(req.user), isRead: false },
      data: { isRead: true }
    });
    res.json({ ok: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Bulk mark, so the page's multi-select doesn't have to fan out one request
// per row. Always scoped to the caller's own notifications.
export async function markManyRead(req, res) {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ error: 'ids required' });

    const { count } = await prisma.notification.updateMany({
      where: { ...baseWhere(req.user), id: { in: ids } },
      data: { isRead: req.body.isRead === false ? false : true }
    });
    res.json({ ok: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteNotification(req, res) {
  try {
    const { count } = await prisma.notification.deleteMany({
      where: { id: req.params.id, userId: req.user.id }
    });
    if (!count) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// `?status=read` clears only what has been read; `?ids=a,b,c` clears an explicit
// selection. Clearing everything needs `?status=all` spelled out, so an
// unqualified DELETE can never wipe the list by accident.
export async function deleteNotifications(req, res) {
  try {
    const { status, ids } = req.query;
    const where = { ...baseWhere(req.user) };

    const idList = String(ids || '').split(',').map(s => s.trim()).filter(Boolean);
    if (idList.length) {
      where.id = { in: idList };
    } else if (status === 'read') {
      where.isRead = true;
    } else if (status !== 'all') {
      return res.status(400).json({ error: "Specify ids, status=read, or status=all" });
    }

    const { count } = await prisma.notification.deleteMany({ where });
    res.json({ ok: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
