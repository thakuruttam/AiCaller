import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const findUniqueMock = vi.fn();
vi.mock('../../../src/db.js', () => ({
  prisma: { workspaceMember: { findUnique: findUniqueMock } },
}));

const {
  authenticate,
  authorize,
  requireSuperAdmin,
  requireWorkspaceMember,
  requireWorkspaceAdmin,
} = await import('../../../src/middleware/auth.js');

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  findUniqueMock.mockReset();
  process.env.JWT_SECRET = 'test-secret';
});

describe('authenticate', () => {
  it('rejects a request with no Authorization header', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access token required' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a header that is not Bearer-prefixed', async () => {
    const req = { headers: { authorization: 'Token abc123' } };
    const res = mockRes();
    const next = vi.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the decoded payload to req.user and calls next() for a valid token', async () => {
    const payload = { id: 'u1', email: 'a@b.com', role: 'ADMIN', workspaceId: 'w1', workspaceRole: 'ADMIN' };
    const token = jwt.sign(payload, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();
    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toMatchObject({ id: 'u1', email: 'a@b.com', role: 'ADMIN' });
  });

  it('rejects an expired or invalid token', async () => {
    const token = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET, { expiresIn: -1 });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = vi.fn();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('authorize', () => {
  it('rejects when req.user is missing', () => {
    const req = {};
    const res = mockRes();
    const next = vi.fn();
    authorize('ADMIN')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN bypasses all role checks', () => {
    const req = { user: { role: 'SUPER_ADMIN' } };
    const res = mockRes();
    const next = vi.fn();
    authorize('ADMIN')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('allows when workspaceRole matches an allowed role', () => {
    const req = { user: { role: 'VIEWER', workspaceRole: 'ADMIN' } };
    const res = mockRes();
    const next = vi.fn();
    authorize('ADMIN', 'EDITOR')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('falls back to req.user.role when workspaceRole is absent', () => {
    const req = { user: { role: 'EDITOR' } };
    const res = mockRes();
    const next = vi.fn();
    authorize('EDITOR')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects with 403 when the effective role is not in the allowed list', () => {
    const req = { user: { role: 'VIEWER' } };
    const res = mockRes();
    const next = vi.fn();
    authorize('ADMIN', 'EDITOR')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireSuperAdmin', () => {
  it('rejects when req.user is missing', () => {
    const res = mockRes();
    const next = vi.fn();
    requireSuperAdmin({}, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects a non-SUPER_ADMIN user with 403', () => {
    const res = mockRes();
    const next = vi.fn();
    requireSuperAdmin({ user: { role: 'ADMIN' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a SUPER_ADMIN user', () => {
    const res = mockRes();
    const next = vi.fn();
    requireSuperAdmin({ user: { role: 'SUPER_ADMIN' } }, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('requireWorkspaceMember', () => {
  it('SUPER_ADMIN bypasses without ever hitting Prisma', async () => {
    const req = { user: { role: 'SUPER_ADMIN' }, params: { id: 'w1' } };
    const res = mockRes();
    const next = vi.fn();
    await requireWorkspaceMember(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it('rejects a non-member with 403', async () => {
    findUniqueMock.mockResolvedValue(null);
    const req = { user: { id: 'u1', role: 'VIEWER' }, params: { id: 'w1' } };
    const res = mockRes();
    const next = vi.fn();
    await requireWorkspaceMember(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { userId_tenantId: { userId: 'u1', tenantId: 'w1' } },
    });
  });

  it('allows a member of any role', async () => {
    findUniqueMock.mockResolvedValue({ role: 'VIEWER' });
    const req = { user: { id: 'u1', role: 'VIEWER' }, params: { id: 'w1' } };
    const res = mockRes();
    const next = vi.fn();
    await requireWorkspaceMember(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});

describe('requireWorkspaceAdmin', () => {
  it('rejects a member whose role is not ADMIN', async () => {
    findUniqueMock.mockResolvedValue({ role: 'EDITOR' });
    const req = { user: { id: 'u1', role: 'EDITOR' }, params: { id: 'w1' } };
    const res = mockRes();
    const next = vi.fn();
    await requireWorkspaceAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a workspace ADMIN', async () => {
    findUniqueMock.mockResolvedValue({ role: 'ADMIN' });
    const req = { user: { id: 'u1', role: 'EDITOR' }, params: { id: 'w1' } };
    const res = mockRes();
    const next = vi.fn();
    await requireWorkspaceAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
  });

  it('SUPER_ADMIN bypasses without hitting Prisma', async () => {
    const req = { user: { role: 'SUPER_ADMIN' }, params: { id: 'w1' } };
    const res = mockRes();
    const next = vi.fn();
    await requireWorkspaceAdmin(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });
});
