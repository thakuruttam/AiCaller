import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';

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
 * POST /api/workspaces — create a new workspace; caller becomes ADMIN
 */
export async function createWorkspace(req, res) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Workspace name is required' });

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();

    const tenant = await prisma.tenant.create({
      data: {
        name,
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
 * POST /api/workspaces/:id/members — add or invite a user by email
 */
export async function addMember(req, res) {
  try {
    const { id } = req.params;
    const { email, name, role = 'VIEWER', password } = req.body;

    if (!email) return res.status(400).json({ error: 'Email is required' });

    let user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user) {
      // Create user account if doesn't exist
      if (!password) return res.status(400).json({ error: 'Password is required for new users' });
      const passwordHash = await bcrypt.hash(password, 12);
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase().trim(),
          name: name || email.split('@')[0],
          passwordHash,
          role: 'VIEWER'
        }
      });
    }

    // Add to workspace (upsert in case they're already a member)
    const membership = await prisma.workspaceMember.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: id } },
      update: { role },
      create: { userId: user.id, tenantId: id, role }
    });

    return res.status(201).json({
      userId: user.id,
      email: user.email,
      name: user.name,
      workspaceRole: membership.role
    });
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
    await prisma.workspaceMember.delete({
      where: { userId_tenantId: { userId, tenantId: id } }
    });
    return res.json({ message: 'Member removed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
