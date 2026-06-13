import jwt from 'jsonwebtoken';
import { prisma } from '../db.js';

/**
 * Verifies the JWT access token and attaches user info to req.user
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, role, workspaceId, workspaceRole }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware factory — checks workspaceRole (with SUPER_ADMIN bypass).
 * Usage: authorize('ADMIN', 'EDITOR')
 */
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // SUPER_ADMIN bypasses all role checks
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const effectiveRole = req.user.workspaceRole || req.user.role;
    if (!allowedRoles.includes(effectiveRole)) {
      return res.status(403).json({
        error: `Insufficient permissions. Required: ${allowedRoles.join(' or ')}`
      });
    }
    next();
  };
}

/**
 * Restricts a route to SUPER_ADMIN only — checks the global role in the token,
 * not the workspace-scoped role.
 */
export function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

/**
 * Allows SUPER_ADMIN or any member of workspace :id (any role).
 */
export async function requireWorkspaceMember(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role === 'SUPER_ADMIN') return next();

  const { id } = req.params;
  const { prisma } = await import('../db.js');
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_tenantId: { userId: req.user.id, tenantId: id } }
  });
  if (!membership) return res.status(403).json({ error: 'Not a member of this workspace' });
  next();
}

/**
 * Allows SUPER_ADMIN or a user who is ADMIN of workspace :id.
 */
export async function requireWorkspaceAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role === 'SUPER_ADMIN') return next();

  const { id } = req.params;
  const { prisma } = await import('../db.js');
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_tenantId: { userId: req.user.id, tenantId: id } }
  });
  if (!membership || membership.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Workspace admin access required' });
  }
  next();
}
