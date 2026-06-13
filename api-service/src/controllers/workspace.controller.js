import { prisma } from '../db.js';
import { sendInviteEmail } from '../utils/email.js';
import { createNotification, notifyWorkspace } from '../utils/notifications.js';

const VALID_INVITE_ROLES = ['ADMIN', 'EDITOR', 'VIEWER'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/workspaces — list workspaces the logged-in user belongs to
 */
export async function listWorkspaces(req, res) {
  try {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: req.user.id },
      include: { tenant: true }
    });
    return res.json(memberships.map(m => ({
      id: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      role: m.role,
      createdAt: m.tenant.createdAt
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * PATCH /api/workspaces/:id — rename workspace
 */
export async function updateWorkspace(req, res) {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

    const conflict = await prisma.tenant.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' }, NOT: { id } }
    });
    if (conflict) return res.status(409).json({ error: 'A workspace with this name already exists' });

    const tenant = await prisma.tenant.update({
      where: { id },
      data: { name: name.trim() }
    });
    return res.json({ id: tenant.id, name: tenant.name, slug: tenant.slug });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/workspaces — create a new workspace; caller becomes ADMIN
 */
export async function createWorkspace(req, res) {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Workspace name is required' });

    const conflict = await prisma.tenant.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } }
    });
    if (conflict) return res.status(409).json({ error: 'A workspace with this name already exists' });

    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();

    const tenant = await prisma.tenant.create({
      data: {
        name: name.trim(),
        slug,
        members: {
          create: { userId: req.user.id, role: 'ADMIN' }
        }
      }
    });

    return res.status(201).json({ id: tenant.id, name: tenant.name, slug: tenant.slug, role: 'ADMIN' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/workspaces/:id/members
 */
export async function listMembers(req, res) {
  try {
    const { id } = req.params;
    const members = await prisma.workspaceMember.findMany({
      where: { tenantId: id },
      include: { user: { select: { id: true, email: true, name: true, role: true, status: true, createdAt: true } } }
    });
    return res.json(members.map(m => ({
      id: m.user.id,
      email: m.user.email,
      name: m.user.name,
      globalRole: m.user.role,
      workspaceRole: m.role,
      status: m.user.status,
      joinedAt: m.createdAt
    })));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/workspaces/:id/invites — create invite + send email
 */
export async function createInvite(req, res) {
  try {
    const { id } = req.params;
    const { email, role = 'VIEWER' } = req.body;

    // Validations
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }
    const normalizedEmail = email.toLowerCase().trim();
    if (!EMAIL_RE.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (!VALID_INVITE_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${VALID_INVITE_ROLES.join(', ')}` });
    }

    const workspace = await prisma.tenant.findUnique({ where: { id } });
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    // Reject if already a member
    const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      const membership = await prisma.workspaceMember.findUnique({
        where: { userId_tenantId: { userId: existingUser.id, tenantId: id } }
      });
      if (membership) {
        return res.status(409).json({ error: 'This user is already a member of this workspace' });
      }
    }

    // Replace any previous pending invite for this email+workspace
    await prisma.invite.deleteMany({ where: { email: normalizedEmail, tenantId: id, usedAt: null } });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invite = await prisma.invite.create({
      data: { email: normalizedEmail, role, tenantId: id, expiresAt }
    });

    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/${invite.token}`;

    // Get inviter name from JWT for the email
    const inviter = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });

    // Send email — report warning in response if it fails but don't block
    let emailWarning = null;
    try {
      await sendInviteEmail({
        toEmail: normalizedEmail,
        inviterName: inviter?.name || 'A workspace admin',
        workspaceName: workspace.name,
        role,
        inviteUrl,
        expiresAt
      });
    } catch (err) {
      console.error('[email] Failed to send invite email:', err.message);
      emailWarning = err.message;
    }

    notifyWorkspace({
      tenantId: id,
      type: 'MEMBER_INVITED',
      title: `Invite sent to ${normalizedEmail}`,
      body: `${inviter?.name || 'An admin'} invited ${normalizedEmail} as ${role}.`
    });

    return res.status(201).json({
      token: invite.token,
      inviteUrl,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt,
      ...(emailWarning && { emailWarning })
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/workspaces/invite/:token/accept — accept invite when already logged in
 */
export async function acceptInvite(req, res) {
  try {
    const { token } = req.params;

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { tenant: { select: { id: true, name: true } } }
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.usedAt) return res.status(410).json({ error: 'This invite has already been used' });
    if (invite.expiresAt < new Date()) return res.status(410).json({ error: 'This invite has expired' });

    // Verify the logged-in user's email matches the invite
    if (req.user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return res.status(403).json({
        error: `This invite was sent to ${invite.email}. Please sign in with that account to accept it.`
      });
    }

    // Check if already a member — never downgrade an existing role
    const existing = await prisma.workspaceMember.findUnique({
      where: { userId_tenantId: { userId: req.user.id, tenantId: invite.tenantId } }
    });

    const effectiveRole = existing ? existing.role : invite.role;

    if (!existing) {
      await prisma.workspaceMember.create({
        data: { userId: req.user.id, tenantId: invite.tenantId, role: invite.role }
      });
    }

    await prisma.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });

    if (!existing) {
      notifyWorkspace({
        tenantId: invite.tenantId,
        type: 'MEMBER_JOINED',
        title: `${req.user.name} joined the workspace`,
        body: `${req.user.name} accepted an invite and joined as ${effectiveRole}.`
      });
    }

    return res.json({
      workspaceId: invite.tenantId,
      workspaceName: invite.tenant.name,
      role: effectiveRole,
      alreadyMember: !!existing
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/invites/:token — public, get invite info for display
 */
export async function getInvite(req, res) {
  try {
    const { token } = req.params;
    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { tenant: { select: { name: true } } }
    });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (invite.usedAt) return res.status(410).json({ error: 'Invite already used' });
    if (invite.expiresAt < new Date()) return res.status(410).json({ error: 'Invite has expired' });

    return res.json({
      email: invite.email,
      role: invite.role,
      workspaceName: invite.tenant.name,
      expiresAt: invite.expiresAt
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/workspaces/:id/members — kept for direct add (existing users)
 */
export async function addMember(req, res) {
  try {
    const { id } = req.params;
    const { userId, role = 'VIEWER' } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const membership = await prisma.workspaceMember.upsert({
      where: { userId_tenantId: { userId, tenantId: id } },
      update: { role },
      create: { userId, tenantId: id, role }
    });

    return res.status(201).json({ userId, workspaceRole: membership.role });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * PATCH /api/workspaces/:id/members/:userId — change a member's workspace role
 */
export async function updateMemberRole(req, res) {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;

    if (!role) return res.status(400).json({ error: 'Role is required' });

    const membership = await prisma.workspaceMember.update({
      where: { userId_tenantId: { userId, tenantId: id } },
      data: { role }
    });

    createNotification({
      userId,
      tenantId: id,
      type: 'MEMBER_ROLE_CHANGED',
      title: 'Your workspace role was updated',
      body: `Your role has been changed to ${role}.`,
    });

    return res.json({ userId, workspaceRole: membership.role });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/**
 * DELETE /api/workspaces/:id/members/:userId
 */
export async function removeMember(req, res) {
  try {
    const { id, userId } = req.params;

    const workspace = await prisma.tenant.findUnique({ where: { id }, select: { name: true } });

    await prisma.workspaceMember.delete({
      where: { userId_tenantId: { userId, tenantId: id } }
    });

    createNotification({
      userId,
      tenantId: id,
      type: 'MEMBER_REMOVED',
      title: 'You were removed from a workspace',
      body: `You have been removed from "${workspace?.name || 'a workspace'}".`,
    });

    return res.json({ message: 'Member removed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
