import { prisma } from '../db.js';
import { createNotification } from '../utils/notifications.js';

// Notify workspace admins + SUPER_ADMINs (not the submitter)
async function notifySupportAdmins({ tenantId, type, title, body, link, skipUserId }) {
  try {
    const recipients = new Map();

    if (tenantId) {
      const adminMembers = await prisma.workspaceMember.findMany({
        where: { tenantId, role: 'ADMIN' },
        select: { userId: true }
      });
      adminMembers.forEach(m => recipients.set(m.userId, tenantId));
    }

    const superAdmins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true }
    });
    superAdmins.forEach(u => {
      if (!recipients.has(u.id)) recipients.set(u.id, tenantId);
    });

    const data = [];
    for (const [userId, tid] of recipients) {
      if (userId === skipUserId) continue;
      // Notifications require tenantId; use a fallback query for SUPER_ADMIN without workspace
      const resolvedTenantId = tid || (await prisma.workspaceMember.findFirst({ where: { userId }, select: { tenantId: true } }))?.tenantId;
      if (resolvedTenantId) {
        data.push({ userId, tenantId: resolvedTenantId, type, title, body, link });
      }
    }

    if (data.length > 0) {
      await prisma.notification.createMany({ data });
    }
  } catch (err) {
    console.error('[support] notifySupportAdmins failed:', err.message, err.stack);
  }
}

export async function createTicket(req, res) {
  const { subject, message, category = 'general' } = req.body;
  if (!subject?.trim() || !message?.trim()) {
    return res.status(400).json({ error: 'Subject and message are required.' });
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId: req.user.id,
      tenantId: req.user.workspaceId || null,
      subject: subject.trim(),
      message: message.trim(),
      category,
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    }
  });

  await notifySupportAdmins({
    tenantId: req.user.workspaceId,
    type: 'SUPPORT_TICKET_SUBMITTED',
    title: `New support request: ${subject.trim()}`,
    body: `${req.user.name} submitted a ${category} ticket.`,
    link: `/admin?tab=support&ticket=${ticket.id}`,
    skipUserId: req.user.id,
  });

  return res.status(201).json(ticket);
}

export async function listTickets(req, res) {
  const { status, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  let where = {};
  if (status && status !== 'all') where.status = status.toUpperCase();

  if (req.user.role === 'SUPER_ADMIN') {
    // SUPER_ADMIN sees all tickets
  } else if (req.user.workspaceRole === 'ADMIN') {
    where.tenantId = req.user.workspaceId;
  } else {
    where.userId = req.user.id;
  }

  const [tickets, total] = await Promise.all([
    prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        tenant: { select: { id: true, name: true } },
        _count: { select: { replies: true } }
      }
    }),
    prisma.supportTicket.count({ where })
  ]);

  return res.json({ tickets, total, page: parseInt(page), limit: parseInt(limit) });
}

export async function getTicket(req, res) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.id },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, avatarUrl: true,
          role: true, status: true, createdAt: true
        }
      },
      tenant: { select: { id: true, name: true, slug: true } },
      replies: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } }
        }
      }
    }
  });

  if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

  const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
  const isWorkspaceAdmin = req.user.workspaceRole === 'ADMIN' && ticket.tenantId === req.user.workspaceId;
  const isOwner = ticket.userId === req.user.id;

  if (!isSuperAdmin && !isWorkspaceAdmin && !isOwner) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  // Fetch extra context for admins: workspace role + total ticket count for this user
  let submitterContext = null;
  if (isSuperAdmin || isWorkspaceAdmin) {
    const [workspaceMember, totalTickets] = await Promise.all([
      ticket.tenantId
        ? prisma.workspaceMember.findUnique({
            where: { userId_tenantId: { userId: ticket.userId, tenantId: ticket.tenantId } }
          })
        : null,
      prisma.supportTicket.count({ where: { userId: ticket.userId } })
    ]);
    submitterContext = {
      workspaceRole: workspaceMember?.role || null,
      workspaceMemberSince: workspaceMember?.createdAt || null,
      totalTickets,
    };
  }

  return res.json({ ...ticket, submitterContext });
}

export async function updateStatus(req, res) {
  const { status } = req.body;
  const valid = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

  const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
  const isWorkspaceAdmin = req.user.workspaceRole === 'ADMIN' && ticket.tenantId === req.user.workspaceId;
  const isOwner = ticket.userId === req.user.id;
  const isAdmin = isSuperAdmin || isWorkspaceAdmin;

  // Owners may only close or reopen their own tickets
  if (!isAdmin && (!isOwner || !['CLOSED', 'OPEN'].includes(status))) {
    return res.status(403).json({ error: 'You can only close or reopen your own tickets.' });
  }

  const updated = await prisma.supportTicket.update({
    where: { id: req.params.id },
    data: { status },
    include: { user: { select: { id: true, name: true, email: true } } }
  });

  const ownerTenantId = ticket.tenantId || req.user.workspaceId;

  if (status === 'RESOLVED' || status === 'CLOSED') {
    // Notify the ticket owner (unless they triggered this themselves)
    if (ticket.userId !== req.user.id && ownerTenantId) {
      await createNotification({
        userId: ticket.userId,
        tenantId: ownerTenantId,
        type: 'SUPPORT_TICKET_RESOLVED',
        title: status === 'RESOLVED'
          ? 'Your support ticket has been resolved'
          : 'Your support ticket has been closed',
        body: `Ticket: "${ticket.subject}" has been marked as ${status.toLowerCase()}.`,
        link: `/support`,
      });
    }
    // Always notify other admins
    await notifySupportAdmins({
      tenantId: ownerTenantId,
      type: 'SUPPORT_TICKET_REPLIED',
      title: `Ticket ${status === 'RESOLVED' ? 'resolved' : 'closed'}: ${ticket.subject}`,
      body: `${req.user.name} marked a ticket as ${status.toLowerCase()}.`,
      link: `/admin?tab=support&ticket=${ticket.id}`,
      skipUserId: req.user.id,
    });
  } else if (status === 'OPEN') {
    // Notify the ticket owner if someone else reopened it
    if (ticket.userId !== req.user.id && ownerTenantId) {
      await createNotification({
        userId: ticket.userId,
        tenantId: ownerTenantId,
        type: 'SUPPORT_TICKET_REPLIED',
        title: 'Your support ticket has been reopened',
        body: `Ticket: "${ticket.subject}" has been reopened.`,
        link: `/support`,
      });
    }
    // Always notify other admins
    await notifySupportAdmins({
      tenantId: ownerTenantId,
      type: 'SUPPORT_TICKET_REPLIED',
      title: `Ticket reopened: ${ticket.subject}`,
      body: `${req.user.name} reopened a support ticket.`,
      link: `/admin?tab=support&ticket=${ticket.id}`,
      skipUserId: req.user.id,
    });
  }

  return res.json(updated);
}

export async function addReply(req, res) {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message is required.' });

  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.params.id } });
  if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });

  const isSuperAdmin = req.user.role === 'SUPER_ADMIN';
  const isWorkspaceAdmin = req.user.workspaceRole === 'ADMIN' && ticket.tenantId === req.user.workspaceId;
  const isOwner = ticket.userId === req.user.id;
  const isAdmin = isSuperAdmin || isWorkspaceAdmin;

  if (!isAdmin && !isOwner) return res.status(403).json({ error: 'Access denied.' });

  const reply = await prisma.supportTicketReply.create({
    data: {
      ticketId: ticket.id,
      userId: req.user.id,
      message: message.trim(),
      isAdmin,
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } }
    }
  });

  // Move to IN_PROGRESS if an admin replies on an OPEN ticket
  if (isAdmin && ticket.status === 'OPEN') {
    await prisma.supportTicket.update({ where: { id: ticket.id }, data: { status: 'IN_PROGRESS' } });
  }

  // Notify the appropriate party
  if (isAdmin) {
    // Notify the ticket owner
    if (ticket.userId !== req.user.id && ticket.tenantId) {
      await createNotification({
        userId: ticket.userId,
        tenantId: ticket.tenantId,
        type: 'SUPPORT_TICKET_REPLIED',
        title: 'Admin replied to your support ticket',
        body: `Your ticket "${ticket.subject}" received a response.`,
        link: `/support`,
      });
    }
  } else {
    // User replied — notify admins
    await notifySupportAdmins({
      tenantId: ticket.tenantId,
      type: 'SUPPORT_TICKET_REPLIED',
      title: `Reply on ticket: ${ticket.subject}`,
      body: `${req.user.name} added a reply to their support ticket.`,
      link: `/admin?tab=support&ticket=${ticket.id}`,
      skipUserId: req.user.id,
    });
  }

  return res.status(201).json(reply);
}
