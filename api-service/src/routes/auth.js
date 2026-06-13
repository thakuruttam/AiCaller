import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { login, refresh, logout, me, updateMe, issueSessionForUser } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

// ── Passport Google strategy ──────────────────────────────────────────────────
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback',
      scope: ['profile', 'email']
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error('No email from Google profile'));

        // Find existing user by googleId or email
        let user = await prisma.user.findFirst({
          where: { OR: [{ googleId: profile.id }, { email }] }
        });

        if (user) {
          // Link googleId if signing in via Google for the first time on an existing email account
          if (!user.googleId) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { googleId: profile.id }
            });
          }
        } else {
          // New user — check for pending invite first
          const pendingInvite = await prisma.invite.findFirst({
            where: { email, usedAt: null, expiresAt: { gt: new Date() } }
          });

          const name = profile.displayName || email.split('@')[0];
          user = await prisma.user.create({
            data: {
              email,
              name,
              googleId: profile.id,
              passwordHash: null,
              role: 'VIEWER'
            }
          });

          if (pendingInvite) {
            // Join invited workspace — no auto-created workspace
            await prisma.workspaceMember.create({
              data: { userId: user.id, tenantId: pendingInvite.tenantId, role: pendingInvite.role }
            });
            await prisma.invite.update({
              where: { id: pendingInvite.id },
              data: { usedAt: new Date() }
            });
          } else {
            // No invite — create their own workspace and make them ADMIN
            const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') + '-' + Date.now();
            const tenant = await prisma.tenant.create({
              data: { name: `${name}'s Workspace`, slug }
            });
            await prisma.workspaceMember.create({
              data: { userId: user.id, tenantId: tenant.id, role: 'ADMIN' }
            });
            user = await prisma.user.update({
              where: { id: user.id },
              data: { role: 'ADMIN' }
            });
          }
        }

        // Also accept any pending invites for existing users logging in via Google
        // Never downgrade an existing role
        const pendingInvites = await prisma.invite.findMany({
          where: { email, usedAt: null, expiresAt: { gt: new Date() } }
        });
        for (const invite of pendingInvites) {
          const existingMembership = await prisma.workspaceMember.findUnique({
            where: { userId_tenantId: { userId: user.id, tenantId: invite.tenantId } }
          });
          if (!existingMembership) {
            await prisma.workspaceMember.create({
              data: { userId: user.id, tenantId: invite.tenantId, role: invite.role }
            });
          }
          await prisma.invite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));
}

// ── Standard auth routes ──────────────────────────────────────────────────────
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, me);
router.put('/me', authenticate, updateMe);
router.post('/switch-workspace', authenticate, async (req, res) => {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    const { prisma } = await import('../db.js');
    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_tenantId: { userId: req.user.id, tenantId: workspaceId } },
      include: { tenant: true }
    });

    if (!membership && req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Not a member of this workspace' });
    }

    const { issueSessionForUser } = await import('../controllers/auth.controller.js');
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    // Temporarily override workspace membership to issue token for target workspace
    const originalWorkspace = user._workspaceOverride;
    const tenantId = membership?.tenantId || workspaceId;
    const tenantName = membership?.tenant?.name || null;
    const workspaceRole = membership?.role || req.user.role;

    const jwt = await import('jsonwebtoken');
    const crypto = await import('crypto');
    const tokenPayload = {
      id: user.id, email: user.email, name: user.name, role: user.role,
      workspaceId: tenantId, workspaceRole
    };
    const accessToken = jwt.default.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '15m'
    });
    const refreshTokenValue = crypto.default.randomBytes(64).toString('hex');
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);
    await prisma.refreshToken.create({ data: { token: refreshTokenValue, userId: user.id, expiresAt: expiryDate } });

    res.json({
      accessToken, refreshToken: refreshTokenValue,
      user: { id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl || null,
        role: user.role, workspaceId: tenantId, workspaceName: tenantName, workspaceRole }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Google OAuth routes ───────────────────────────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=google_failed' }),
  async (req, res) => {
    try {
      const session = await issueSessionForUser(req.user);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const params = new URLSearchParams({
        token:        session.accessToken,
        refreshToken: session.refreshToken,
        user:         JSON.stringify(session.user)
      });
      res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
    } catch (err) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/login?error=google_failed`);
    }
  }
);

export default router;
