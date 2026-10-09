import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { sendPasswordResetEmail, isEmailConfigured } from '../utils/email.js';

// Shared helper used by password login and Google OAuth
export async function issueSessionForUser(user) {
  const workspace = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    include: { tenant: true }
  });

  const tokenPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    workspaceId: workspace?.tenant?.id || null,
    workspaceRole: workspace?.role || user.role
  };

  const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m'
  });
  const refreshTokenValue = crypto.randomBytes(64).toString('hex');

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 7);
  await prisma.refreshToken.create({
    data: { token: refreshTokenValue, userId: user.id, expiresAt: expiryDate }
  });

  return {
    accessToken,
    refreshToken: refreshTokenValue,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl || null,
      role: user.role,
      workspaceId: workspace?.tenant?.id || null,
      workspaceName: workspace?.tenant?.name || null,
      workspaceRole: workspace?.role || user.role
    }
  };
}

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

    if (!user.passwordHash) {
      return res.status(401).json({
        error: 'This account uses Google sign-in — use the "Continue with Google" button instead',
        code: 'GOOGLE_ACCOUNT_NO_PASSWORD'
      });
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
        avatarUrl: user.avatarUrl || null,
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
    const { refreshToken, workspaceId: requestedWorkspaceId } = req.body;
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

    // Honor the requested workspace if the user is still a member; otherwise fall back to first
    let activeWorkspace = requestedWorkspaceId
      ? user.workspaces.find(m => m.tenantId === requestedWorkspaceId)
      : null;
    if (!activeWorkspace) activeWorkspace = user.workspaces[0];

    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      workspaceId: activeWorkspace?.tenantId || null,
      workspaceRole: activeWorkspace?.role || user.role
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
      avatarUrl: user.avatarUrl || null,
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

// ─────────────────────────────────────────────────────────────────────────
// Password reset
//
// Before this existed, "Forgot password?" on the sign-in screen was an
// href="#" with no route behind it — a forgotten password meant a permanent
// lockout, since there is no self-signup and the Support form itself
// requires being signed in.
// ─────────────────────────────────────────────────────────────────────────

const RESET_TTL_MINUTES = 60;
// One live request per address per minute. Cheap throttle against someone
// using this endpoint to mailbomb a user, without standing up a rate limiter.
const RESET_THROTTLE_MS = 60 * 1000;
const MIN_PASSWORD_LENGTH = 8;

// Only the hash is stored (see PasswordResetToken in schema.prisma), so the
// lookup has to hash the incoming token the same way.
function hashResetToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

/**
 * POST /api/auth/forgot-password  { email }
 *
 * Always answers the same way, whatever the address turns out to be: no
 * account, a suspended one, a Google-only one, or a successful send all
 * return the identical body. Anything else makes this form an account
 * lookup — "does this person use your product" is not ours to disclose.
 */
export async function forgotPassword(req, res) {
  const { email } = req.body || {};

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Enter the email address you sign in with.' });
  }

  const emailConfigured = isEmailConfigured();

  // An operator problem, not a user one, and it leaks nothing — say so
  // plainly instead of pretending a mail went out that never can.
  //
  // Outside production we carry on and print the link to the server log
  // instead (see below), so the flow is testable on a local checkout with
  // no mail credentials. In production a missing key is a hard stop: the
  // token is a bearer credential and must never reach a log file.
  if (!emailConfigured && process.env.NODE_ENV === 'production') {
    console.error('[Auth] forgot-password called but Resend is not configured (RESEND_API_KEY / RESEND_FROM_EMAIL).');
    return res.status(503).json({
      error: 'Password reset email is not configured on this server. Contact your administrator.',
    });
  }

  const sameAnswer = () => res.json({
    message: 'If that address has an account, a reset link is on its way. It expires in 60 minutes.',
  });

  try {
    const normalized = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalized } });

    if (!user || user.status === 'SUSPENDED') return sameAnswer();

    const recent = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id, createdAt: { gt: new Date(Date.now() - RESET_THROTTLE_MS) } },
    });
    if (recent) return sameAnswer();

    // Google-only account: no password exists to reset. The mailbox owner is
    // told what to do instead; the HTTP response stays identical.
    if (!user.passwordHash) {
      if (emailConfigured) {
        await sendPasswordResetEmail({ toEmail: normalized, name: user.name, googleOnly: true });
      } else {
        console.warn(`[Auth] DEV: ${normalized} is a Google-only account — no password to reset.`);
      }
      return sameAnswer();
    }

    const raw = crypto.randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: hashResetToken(raw),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
      },
    });

    const resetUrl = `${frontendUrl()}/reset-password/${raw}`;

    if (emailConfigured) {
      await sendPasswordResetEmail({
        toEmail: normalized,
        name: user.name,
        resetUrl,
        expiresInMinutes: RESET_TTL_MINUTES,
      });
    } else {
      // Non-production only — the guard above already hard-stops in prod.
      console.warn(
        `\n[Auth] DEV ONLY — no mail credentials, so here is the reset link for ${normalized}:\n        ${resetUrl}\n`,
      );
    }

    return sameAnswer();
  } catch (err) {
    // Still the same answer — a failure here must not become a signal about
    // whether the address exists. Logged loudly so it's visible to us.
    console.error('[Auth] forgot-password error:', err);
    return sameAnswer();
  }
}

/**
 * GET /api/auth/reset-password/:token
 *
 * Lets the screen check the link before asking for a new password, so a dead
 * link is caught up front rather than after someone types one in twice.
 */
export async function checkResetToken(req, res) {
  try {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(req.params.token || '') },
      include: { user: { select: { email: true, name: true } } },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return res.status(400).json({ valid: false, error: 'This reset link has expired or has already been used.' });
    }
    return res.json({ valid: true, email: record.user.email, name: record.user.name });
  } catch (err) {
    console.error('[Auth] checkResetToken error:', err);
    return res.status(500).json({ valid: false, error: 'Could not check this link. Please try again.' });
  }
}

/**
 * POST /api/auth/reset-password  { token, password }
 *
 * On success the caller is signed straight in — the alternative is bouncing
 * someone who just proved control of the mailbox back to a login form to
 * retype the password they set one second ago.
 */
export async function resetPassword(req, res) {
  const { token, password } = req.body || {};

  if (!token || !password) {
    return res.status(400).json({ error: 'Reset link and new password are both required.' });
  }
  if (String(password).length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` });
  }

  try {
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashResetToken(token) },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return res.status(400).json({
        error: 'This reset link has expired or has already been used. Request a new one.',
      });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
      await tx.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });
      // Any other outstanding reset link for this user is now moot.
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
      // Changing a password signs out every other session — the usual reason
      // for resetting one is that someone else may have had access.
      await tx.refreshToken.deleteMany({ where: { userId: record.userId } });
    });

    const session = await issueSessionForUser({ ...record.user, passwordHash });
    return res.json(session);
  } catch (err) {
    console.error('[Auth] reset-password error:', err);
    return res.status(500).json({ error: 'Could not reset your password. Please try again.' });
  }
}

/**
 * PUT /api/auth/me
 */
export async function updateMe(req, res) {
  try {
    const { name, avatarUrl } = req.body;
    const updates = {};
    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ error: 'Name cannot be empty' });
      updates.name = name.trim();
    }
    if (avatarUrl !== undefined) {
      updates.avatarUrl = avatarUrl || null;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nothing to update' });
    }
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updates,
    });
    return res.json({ id: user.id, name: user.name, avatarUrl: user.avatarUrl, email: user.email });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}
