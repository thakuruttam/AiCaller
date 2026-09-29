import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/db.js');
const { channelsFor } = await import('../../src/notifications/preferences.js');

let tenant;
let userId;

function authHeader(role = 'ADMIN') {
  const token = jwt.sign(
    { id: userId, email: 'n@b.com', role, workspaceId: tenant.id, workspaceRole: 'ADMIN' },
    process.env.JWT_SECRET
  );
  return `Bearer ${token}`;
}

async function seed(rows) {
  await prisma.notification.createMany({
    data: rows.map((r, i) => ({
      userId,
      tenantId: tenant.id,
      type: r.type || 'CAMPAIGN_CREATED',
      title: r.title || `Notification ${i}`,
      body: r.body || 'Body text',
      link: r.link ?? null,
      isRead: r.isRead ?? false,
      createdAt: r.createdAt || new Date(Date.now() - i * 1000),
    })),
  });
}

beforeEach(async () => {
  tenant = await prisma.tenant.create({
    data: { name: 'Notif Tenant', slug: 'notif-' + Date.now() + '-' + Math.random().toString(36).slice(2) },
  });
  const user = await prisma.user.create({
    data: {
      email: `notif-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`,
      name: 'Notif User',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/notifications', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('returns an envelope with items, paging and scope-wide counts', async () => {
    await seed([{ isRead: true }, { isRead: false }, { isRead: false }]);

    const res = await request(app).get('/api/notifications').set('Authorization', authHeader());

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.total).toBe(3);
    expect(res.body.counts).toEqual({ all: 3, unread: 2, read: 1 });
  });

  it('paginates', async () => {
    await seed(Array.from({ length: 5 }, (_, i) => ({ title: `N${i}` })));

    const res = await request(app)
      .get('/api/notifications?page=2&limit=2')
      .set('Authorization', authHeader());

    expect(res.body.items).toHaveLength(2);
    expect(res.body.page).toBe(2);
    expect(res.body.pages).toBe(3);
  });

  it('filters by read status', async () => {
    await seed([{ isRead: true }, { isRead: false }]);

    const res = await request(app)
      .get('/api/notifications?status=unread')
      .set('Authorization', authHeader());

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].isRead).toBe(false);
    // Counts describe the whole scope, not the filtered slice.
    expect(res.body.counts.all).toBe(2);
  });

  it('filters by a comma-separated type list', async () => {
    await seed([{ type: 'CALL_FAILED' }, { type: 'CAMPAIGN_CREATED' }, { type: 'BALANCE_LOW' }]);

    const res = await request(app)
      .get('/api/notifications?type=CALL_FAILED,BALANCE_LOW')
      .set('Authorization', authHeader());

    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.map(n => n.type).sort()).toEqual(['BALANCE_LOW', 'CALL_FAILED']);
  });

  it('searches title and body', async () => {
    await seed([
      { title: 'Campaign launched', body: 'nothing here' },
      { title: 'Unrelated', body: 'mentions launched in the body' },
      { title: 'Nope', body: 'nope' },
    ]);

    const res = await request(app)
      .get('/api/notifications?q=launched')
      .set('Authorization', authHeader());

    expect(res.body.items).toHaveLength(2);
  });

  it('does not leak another user\'s notifications', async () => {
    const other = await prisma.user.create({
      data: { email: `other-${Date.now()}@test.com`, name: 'Other', role: 'ADMIN', status: 'ACTIVE' },
    });
    await prisma.notification.create({
      data: { userId: other.id, tenantId: tenant.id, type: 'CALL_FAILED', title: 'Theirs', body: 'x' },
    });
    await seed([{ title: 'Mine' }]);

    const res = await request(app).get('/api/notifications').set('Authorization', authHeader());

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].title).toBe('Mine');
  });
});

describe('notification mutations', () => {
  it('marks one read, then unread again', async () => {
    await seed([{ isRead: false }]);
    const { id } = await prisma.notification.findFirst({ where: { userId } });

    await request(app).patch(`/api/notifications/${id}/read`).set('Authorization', authHeader()).expect(200);
    expect((await prisma.notification.findUnique({ where: { id } })).isRead).toBe(true);

    await request(app).patch(`/api/notifications/${id}/unread`).set('Authorization', authHeader()).expect(200);
    expect((await prisma.notification.findUnique({ where: { id } })).isRead).toBe(false);
  });

  it('404s marking a notification that is not yours', async () => {
    const other = await prisma.user.create({
      data: { email: `other2-${Date.now()}@test.com`, name: 'Other', role: 'ADMIN', status: 'ACTIVE' },
    });
    const theirs = await prisma.notification.create({
      data: { userId: other.id, tenantId: tenant.id, type: 'CALL_FAILED', title: 'Theirs', body: 'x' },
    });

    await request(app)
      .patch(`/api/notifications/${theirs.id}/read`)
      .set('Authorization', authHeader())
      .expect(404);
  });

  it('marks many in one request', async () => {
    await seed([{}, {}, {}]);
    const ids = (await prisma.notification.findMany({ where: { userId } })).map(n => n.id).slice(0, 2);

    const res = await request(app)
      .patch('/api/notifications/read-many')
      .set('Authorization', authHeader())
      .send({ ids });

    expect(res.body.count).toBe(2);
    expect(await prisma.notification.count({ where: { userId, isRead: true } })).toBe(2);
  });

  it('rejects read-many with no ids', async () => {
    await request(app)
      .patch('/api/notifications/read-many')
      .set('Authorization', authHeader())
      .send({ ids: [] })
      .expect(400);
  });

  it('deletes one', async () => {
    await seed([{}]);
    const { id } = await prisma.notification.findFirst({ where: { userId } });

    await request(app).delete(`/api/notifications/${id}`).set('Authorization', authHeader()).expect(200);
    expect(await prisma.notification.findUnique({ where: { id } })).toBeNull();
  });

  it('clears only read notifications with status=read', async () => {
    await seed([{ isRead: true }, { isRead: true }, { isRead: false }]);

    const res = await request(app)
      .delete('/api/notifications?status=read')
      .set('Authorization', authHeader());

    expect(res.body.count).toBe(2);
    expect(await prisma.notification.count({ where: { userId } })).toBe(1);
  });

  it('refuses an unqualified delete so the list cannot be wiped by accident', async () => {
    await seed([{}, {}]);

    await request(app).delete('/api/notifications').set('Authorization', authHeader()).expect(400);
    expect(await prisma.notification.count({ where: { userId } })).toBe(2);
  });
});

describe('channel preferences', () => {
  const env = { ...process.env };
  beforeEach(() => {
    delete process.env.NOTIFY_EMAIL_TYPES;
    delete process.env.NOTIFY_SMS_TYPES;
  });
  afterAll(() => { process.env = env; });

  it('defaults to email only', () => {
    expect(channelsFor({}, 'CAMPAIGN_CREATED')).toEqual(['email']);
  });

  it('adds SMS for high-priority types once the user opts in', () => {
    expect(channelsFor({ notifyChannels: { sms: true } }, 'CALL_FAILED')).toEqual(['email', 'sms']);
    // ...but not for routine ones, even with SMS enabled.
    expect(channelsFor({ notifyChannels: { sms: true } }, 'CAMPAIGN_CREATED')).toEqual(['email']);
  });

  it('honours a whole-channel opt-out', () => {
    expect(channelsFor({ notifyChannels: { email: false } }, 'CAMPAIGN_CREATED')).toEqual([]);
  });

  it('lets a per-type override win over everything else', () => {
    const user = { notifyChannels: { email: false, types: { CALL_FAILED: ['sms'] } } };
    expect(channelsFor(user, 'CALL_FAILED')).toEqual(['sms']);
  });

  it('respects an env allow-list', () => {
    process.env.NOTIFY_EMAIL_TYPES = 'CALL_FAILED';
    expect(channelsFor({}, 'CALL_FAILED')).toEqual(['email']);
    expect(channelsFor({}, 'CAMPAIGN_CREATED')).toEqual([]);
  });
});
