import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../db.js';

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  });
}

function signRefreshToken() {
  return crypto.randomBytes(64).toString('hex');
}

/**
 * POST /api/auth/login
 */
export async function login(req, res) {
  try {
    const { email, password, workspaceId } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { workspaces: { include: { tenant: true } } }
    });

    if (!user || user.status === 'SUSPENDED') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Determine active workspace
    let activeWorkspace = null;
    let workspaceRole = null;

    if (workspaceId) {
      const membership = user.workspaces.find(m => m.tenantId === workspaceId);
      if (membership) {
        activeWorkspace = membership.tenant;
        workspaceRole = membership.role;
      }
    }

    if (!activeWorkspace && user.workspaces.length > 0) {
      activeWorkspace = user.workspaces[0].tenant;
      workspaceRole = user.workspaces[0].role;
    }

    // Build token payload
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      workspaceId: activeWorkspace?.id || null,
      workspaceRole: workspaceRole || user.role
    };

    const accessToken = signAccessToken(tokenPayload);
    const refreshTokenValue = signRefreshToken();

    // Store refresh token in DB
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        userId: user.id,
        expiresAt: expiryDate
      }
    });

    return res.json({
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        workspaceId: activeWorkspace?.id || null,
        workspaceName: activeWorkspace?.name || null,
        workspaceRole
      },
      workspaces: user.workspaces.map(m => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        role: m.role
      }))
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/auth/refresh
 */
export async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        user: {
          include: { workspaces: { include: { tenant: true } } }
        }
      }
    });

    if (!stored || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = stored.user;
    const firstWorkspace = user.workspaces[0];

    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      workspaceId: firstWorkspace?.tenantId || null,
      workspaceRole: firstWorkspace?.role || user.role
    };

    const accessToken = signAccessToken(tokenPayload);
    return res.json({ accessToken });
  } catch (err) {
    console.error('[Auth] Refresh error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    return res.json({ message: 'Logged out successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/auth/me
 */
export async function me(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { workspaces: { include: { tenant: true } } }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      workspaces: user.workspaces.map(m => ({
        id: m.tenant.id,
        name: m.tenant.name,
        slug: m.tenant.slug,
        role: m.role
      }))
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
