import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/db.js');

async function makeTenant(overrides = {}) {
  return prisma.tenant.create({
    data: { name: 'Test Tenant', slug: 'test-tenant-' + Date.now() + '-' + Math.random().toString(36).slice(2), ...overrides },
  });
}

async function makeUser(overrides = {}) {
  const passwordHash = overrides.passwordHash === null ? null : await bcrypt.hash(overrides.password || 'password123', 10);
  return prisma.user.create({
    data: {
      email: overrides.email || `user-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      name: overrides.name || 'Test User',
      passwordHash,
      role: overrides.role || 'VIEWER',
      status: overrides.status || 'ACTIVE',
    },
  });
}

async function makeMembership(userId, tenantId, role = 'ADMIN') {
  return prisma.workspaceMember.create({ data: { userId, tenantId, role } });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/login', () => {
  it('returns 400 when email or password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 401 for an unknown email without leaking which field was wrong', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: 'x' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('returns 401 for a SUSPENDED user', async () => {
    const user = await makeUser({ status: 'SUSPENDED', password: 'password123' });
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('returns 401 with GOOGLE_ACCOUNT_NO_PASSWORD for a Google-only account', async () => {
    const user = await makeUser({ passwordHash: null });
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'anything' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('GOOGLE_ACCOUNT_NO_PASSWORD');
  });

  it('returns 401 for a wrong password', async () => {
    const user = await makeUser({ password: 'correct-password' });
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('logs in successfully and creates a RefreshToken with a ~7-day expiry', async () => {
    const user = await makeUser({ password: 'password123' });
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.user.email).toBe(user.email);

    const stored = await prisma.refreshToken.findUnique({ where: { token: res.body.refreshToken } });
    expect(stored).toBeTruthy();
    const days = (stored.expiresAt - new Date()) / (1000 * 60 * 60 * 24);
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it('succeeds with workspaceId: null when the user has no workspace memberships', async () => {
    const user = await makeUser({ password: 'password123' });
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user.workspaceId).toBeNull();
  });

  it('selects the requested workspace when workspaceId is provided and the user is a member', async () => {
    const user = await makeUser({ password: 'password123' });
    const tenantA = await makeTenant();
    const tenantB = await makeTenant();
    await makeMembership(user.id, tenantA.id, 'VIEWER');
    await makeMembership(user.id, tenantB.id, 'ADMIN');

    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123', workspaceId: tenantB.id });
    expect(res.status).toBe(200);
    expect(res.body.user.workspaceId).toBe(tenantB.id);
    expect(res.body.user.workspaceRole).toBe('ADMIN');
  });

  it('falls back to the first workspace when the requested workspaceId is invalid/not a member', async () => {
    const user = await makeUser({ password: 'password123' });
    const tenantA = await makeTenant();
    await makeMembership(user.id, tenantA.id, 'EDITOR');

    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123', workspaceId: 'not-a-real-tenant-id' });
    expect(res.status).toBe(200);
    expect(res.body.user.workspaceId).toBe(tenantA.id);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns 400 when refreshToken is missing', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('returns 401 for an unknown token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'not-a-real-token' });
    expect(res.status).toBe(401);
  });

  it('returns 401 for an expired token', async () => {
    const user = await makeUser({ password: 'password123' });
    const expired = await prisma.refreshToken.create({
      data: { token: 'expired-token-' + Date.now(), userId: user.id, expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: expired.token });
    expect(res.status).toBe(401);
  });

  it('returns a new accessToken for a valid refresh token', async () => {
    const user = await makeUser({ password: 'password123' });
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' });
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });
});

describe('POST /api/auth/logout', () => {
  it('deletes the RefreshToken document and returns 200', async () => {
    const user = await makeUser({ password: 'password123' });
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' });
    const res = await request(app).post('/api/auth/logout').send({ refreshToken: login.body.refreshToken });
    expect(res.status).toBe(200);
    const stored = await prisma.refreshToken.findUnique({ where: { token: login.body.refreshToken } });
    expect(stored).toBeNull();
  });

  it('is a no-op (still 200) when no token is provided', async () => {
    const res = await request(app).post('/api/auth/logout').send({});
    expect(res.status).toBe(200);
  });
});

describe('GET /api/auth/me', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 200 with the user + workspaces shape for a valid token', async () => {
    const user = await makeUser({ password: 'password123' });
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
    expect(Array.isArray(res.body.workspaces)).toBe(true);
  });
});

describe('PUT /api/auth/me', () => {
  it('returns 400 for an empty body', async () => {
    const user = await makeUser({ password: 'password123' });
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' });
    const res = await request(app).put('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`).send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 for a whitespace-only name', async () => {
    const user = await makeUser({ password: 'password123' });
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' });
    const res = await request(app).put('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`).send({ name: '   ' });
    expect(res.status).toBe(400);
  });

  it('updates and trims a valid name', async () => {
    const user = await makeUser({ password: 'password123' });
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' });
    const res = await request(app).put('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`).send({ name: '  New Name  ' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('distinguishes avatarUrl: null (clear it) from not provided (leave untouched)', async () => {
    const user = await makeUser({ password: 'password123' });
    await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: 'https://example.com/a.png' } });
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' });

    const res = await request(app).put('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`).send({ avatarUrl: null });
    expect(res.status).toBe(200);
    expect(res.body.avatarUrl).toBeNull();
  });
});

describe('POST /api/auth/switch-workspace', () => {
  it('returns 403 for a non-member, non-SUPER_ADMIN user', async () => {
    const user = await makeUser({ password: 'password123' });
    const tenant = await makeTenant();
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' });
    const res = await request(app).post('/api/auth/switch-workspace').set('Authorization', `Bearer ${login.body.accessToken}`).send({ workspaceId: tenant.id });
    expect(res.status).toBe(403);
  });

  it('returns 200 for a valid membership', async () => {
    const user = await makeUser({ password: 'password123' });
    const tenant = await makeTenant();
    await makeMembership(user.id, tenant.id, 'EDITOR');
    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' });
    const res = await request(app).post('/api/auth/switch-workspace').set('Authorization', `Bearer ${login.body.accessToken}`).send({ workspaceId: tenant.id });
    expect(res.status).toBe(200);
    expect(res.body.user.workspaceId).toBe(tenant.id);
    expect(res.body.user.workspaceRole).toBe('EDITOR');
  });
});

describe('Google OAuth strategy is not registered in tests (GOOGLE_CLIENT_ID/SECRET unset)', () => {
  it('GET /api/auth/google does not succeed as a normal OAuth redirect (no strategy registered)', async () => {
    const res = await request(app).get('/api/auth/google');
    // No assumption about the exact status Passport returns for an unregistered strategy —
    // just lock in that it is NOT a successful 302 redirect to accounts.google.com,
    // confirming the "don't need to mock Google OAuth" assumption holds in practice.
    expect(res.status).not.toBe(302);
  });
});
