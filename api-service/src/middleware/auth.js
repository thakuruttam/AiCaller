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
 * Middleware factory — only allows users whose workspaceRole is in the list
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
