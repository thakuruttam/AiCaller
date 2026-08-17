import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const enqueueCallMock = vi.fn().mockResolvedValue(undefined);
const publishEvaluationMock = vi.fn().mockResolvedValue(undefined);
const notifyWorkspaceMock = vi.fn().mockResolvedValue(undefined);
const hangupPlivoCallMock = vi.fn().mockResolvedValue(undefined);
const fetchPlivoRecordingUrlMock = vi.fn().mockResolvedValue(null);

vi.mock('../../src/queue/publisher.js', () => ({ enqueueCall: (...a) => enqueueCallMock(...a) }));
vi.mock('../../src/queue/singletons.js', () => ({ publishEvaluation: (...a) => publishEvaluationMock(...a) }));
vi.mock('../../src/utils/notifications.js', () => ({
  notifyWorkspace: (...a) => notifyWorkspaceMock(...a),
  createNotification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../src/utils/plivoRest.js', () => ({
  hangupPlivoCall: (...a) => hangupPlivoCallMock(...a),
  fetchPlivoRecordingUrl: (...a) => fetchPlivoRecordingUrlMock(...a),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/db.js');

async function makeTenant() {
  return prisma.tenant.create({ data: { name: 'Campaign Tenant', slug: 'campaign-' + Date.now() + '-' + Math.random().toString(36).slice(2) } });
}
async function makeUser(role = 'ADMIN') {
  return prisma.user.create({ data: { email: `u-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`, name: 'U', passwordHash: 'x', role } });
}
async function makeCallModule(tenantId) {
  return prisma.callModule.create({ data: { name: 'Module', tenantId } });
}
function authHeader({ userId, tenantId, role = 'ADMIN', workspaceRole = 'ADMIN' }) {
  const token = jwt.sign({ id: userId, email: 'a@b.com', role, workspaceId: tenantId, workspaceRole }, process.env.JWT_SECRET);
  return `Bearer ${token}`;
}

beforeEach(() => {
  enqueueCallMock.mockClear();
  publishEvaluationMock.mockClear();
  notifyWorkspaceMock.mockClear();
  hangupPlivoCallMock.mockClear();
  fetchPlivoRecordingUrlMock.mockClear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/campaigns — visibility filtering', () => {
  it('a non-admin (EDITOR) only sees campaigns they created', async () => {
    const tenant = await makeTenant();
    const callModule = await makeCallModule(tenant.id);
    const owner = await makeUser('EDITOR');
    const other = await makeUser('EDITOR');
    await prisma.campaign.create({ data: { name: 'Owned', tenantId: tenant.id, callModuleId: callModule.id, createdById: owner.id } });
    await prisma.campaign.create({ data: { name: 'Not Owned', tenantId: tenant.id, callModuleId: callModule.id, createdById: other.id } });

    const res = await request(app).get('/api/campaigns').set('Authorization', authHeader({ userId: owner.id, tenantId: tenant.id, role: 'EDITOR', workspaceRole: 'EDITOR' }));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Owned');
  });

  it('an ADMIN sees all campaigns in their tenant, not just their own', async () => {
    const tenant = await makeTenant();
    const callModule = await makeCallModule(tenant.id);
    const admin = await makeUser('ADMIN');
    const other = await makeUser('EDITOR');
    await prisma.campaign.create({ data: { name: 'Admin Campaign', tenantId: tenant.id, callModuleId: callModule.id, createdById: admin.id } });
    await prisma.campaign.create({ data: { name: 'Other Campaign', tenantId: tenant.id, callModuleId: callModule.id, createdById: other.id } });

    const res = await request(app).get('/api/campaigns').set('Authorization', authHeader({ userId: admin.id, tenantId: tenant.id, role: 'ADMIN', workspaceRole: 'ADMIN' }));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('never returns campaigns from a different tenant for a regular workspace user', async () => {
    const tenant = await makeTenant();
    const otherTenant = await makeTenant();
    const callModule = await makeCallModule(tenant.id);
    const otherCallModule = await makeCallModule(otherTenant.id);
    const admin = await makeUser('ADMIN');
    await prisma.campaign.create({ data: { name: 'Mine', tenantId: tenant.id, callModuleId: callModule.id, createdById: admin.id } });
    await prisma.campaign.create({ data: { name: 'Theirs', tenantId: otherTenant.id, callModuleId: otherCallModule.id, createdById: admin.id } });

    const res = await request(app).get('/api/campaigns').set('Authorization', authHeader({ userId: admin.id, tenantId: tenant.id, role: 'ADMIN', workspaceRole: 'ADMIN' }));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Mine');
  });
});

describe('GET /api/campaigns/:id — access control (route middleware + controller)', () => {
  it('returns 404 for a nonexistent campaign', async () => {
    const tenant = await makeTenant();
    const admin = await makeUser('ADMIN');
    const res = await request(app).get('/api/campaigns/nonexistent-id').set('Authorization', authHeader({ userId: admin.id, tenantId: tenant.id }));
    expect(res.status).toBe(404);
  });

  it('returns 403 for a campaign in a different tenant', async () => {
    const tenant = await makeTenant();
    const otherTenant = await makeTenant();
    const callModule = await makeCallModule(otherTenant.id);
    const owner = await makeUser('ADMIN');
    const campaign = await prisma.campaign.create({ data: { name: 'X', tenantId: otherTenant.id, callModuleId: callModule.id, createdById: owner.id } });

    const requester = await makeUser('ADMIN');
    const res = await request(app).get(`/api/campaigns/${campaign.id}`).set('Authorization', authHeader({ userId: requester.id, tenantId: tenant.id }));
    expect(res.status).toBe(403);
  });

  it('returns 403 for a same-tenant non-admin who does not own the campaign', async () => {
    const tenant = await makeTenant();
    const callModule = await makeCallModule(tenant.id);
    const owner = await makeUser('EDITOR');
    const campaign = await prisma.campaign.create({ data: { name: 'X', tenantId: tenant.id, callModuleId: callModule.id, createdById: owner.id } });

    const other = await makeUser('EDITOR');
    const res = await request(app).get(`/api/campaigns/${campaign.id}`)
      .set('Authorization', authHeader({ userId: other.id, tenantId: tenant.id, role: 'EDITOR', workspaceRole: 'EDITOR' }));
    expect(res.status).toBe(403);
  });

  it('allows a same-tenant ADMIN to view a campaign they did not create', async () => {
    const tenant = await makeTenant();
    const callModule = await makeCallModule(tenant.id);
    const owner = await makeUser('EDITOR');
    const campaign = await prisma.campaign.create({ data: { name: 'X', tenantId: tenant.id, callModuleId: callModule.id, createdById: owner.id } });

    const admin = await makeUser('ADMIN');
    const res = await request(app).get(`/api/campaigns/${campaign.id}`).set('Authorization', authHeader({ userId: admin.id, tenantId: tenant.id }));
    expect(res.status).toBe(200);
  });

  it('allows SUPER_ADMIN to view a campaign in any tenant', async () => {
    const tenant = await makeTenant();
    const callModule = await makeCallModule(tenant.id);
    const owner = await makeUser('EDITOR');
    const campaign = await prisma.campaign.create({ data: { name: 'X', tenantId: tenant.id, callModuleId: callModule.id, createdById: owner.id } });

    const superAdmin = await makeUser('SUPER_ADMIN');
    const res = await request(app).get(`/api/campaigns/${campaign.id}`)
      .set('Authorization', authHeader({ userId: superAdmin.id, tenantId: 'some-other-workspace', role: 'SUPER_ADMIN' }));
    expect(res.status).toBe(200);
  });
});

describe('POST /api/campaigns/wizard — createWizardCampaign', () => {
  it('returns 400 when the user has no active workspace', async () => {
    const admin = await makeUser('ADMIN');
    const token = jwt.sign({ id: admin.id, email: 'a@b.com', role: 'ADMIN', workspaceId: null, workspaceRole: 'ADMIN' }, process.env.JWT_SECRET);
    const res = await request(app).post('/api/campaigns/wizard').set('Authorization', `Bearer ${token}`).send({ name: 'Test' });
    expect(res.status).toBe(400);
  });

  it('creates a callModule + campaign, dedupes contacts by phone, and computes estimatedTotalMinutes', async () => {
    const tenant = await makeTenant();
    const admin = await makeUser('ADMIN');
    const res = await request(app).post('/api/campaigns/wizard').set('Authorization', authHeader({ userId: admin.id, tenantId: tenant.id })).send({
      name: 'New Campaign',
      type: 'SALES',
      prompt: 'Sell things',
      goals: { goal: 'close deals' },
      callSettings: { maxDuration: 3 }, // -> 180s max duration
      contacts: [
        { name: 'A', phone: '+111' },
        { name: 'A Duplicate', phone: '+111' }, // same phone, should dedupe to 1
        { name: 'B', phone: '+222' },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.contactsCreated).toBe(2); // deduped from 3 to 2
    expect(notifyWorkspaceMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'CAMPAIGN_CREATED' }));

    const campaign = await prisma.campaign.findUnique({ where: { id: res.body.campaign.id } });
    expect(campaign.maxCallDurationSec).toBe(180);
    expect(campaign.estimatedTotalMinutes).toBe(2 * 3); // 2 contacts * 3 min each (180s/60)

    const contacts = await prisma.contact.findMany({ where: { tenantId: tenant.id } });
    expect(contacts).toHaveLength(2);
  });

  it('reuses an existing contact by phone number rather than creating a duplicate', async () => {
    const tenant = await makeTenant();
    const admin = await makeUser('ADMIN');
    await prisma.contact.create({ data: { name: 'Existing', phone: '+999', tenantId: tenant.id } });

    await request(app).post('/api/campaigns/wizard').set('Authorization', authHeader({ userId: admin.id, tenantId: tenant.id })).send({
      name: 'Reuse Test',
      contacts: [{ name: 'Existing Renamed', phone: '+999' }],
    });

    const contacts = await prisma.contact.findMany({ where: { tenantId: tenant.id, phone: '+999' } });
    expect(contacts).toHaveLength(1);
  });
});

describe('POST /api/campaigns/:id/status — updateCampaignStatus', () => {
  async function setupCampaignWithLogs(statuses) {
    const tenant = await makeTenant();
    const callModule = await makeCallModule(tenant.id);
    const admin = await makeUser('ADMIN');
    const campaign = await prisma.campaign.create({ data: { name: 'Status Campaign', tenantId: tenant.id, callModuleId: callModule.id, createdById: admin.id } });
    const contact = await prisma.contact.create({ data: { name: 'C', phone: '+1', tenantId: tenant.id } });
    const logs = [];
    for (const status of statuses) {
      logs.push(await prisma.callLog.create({ data: { tenantId: tenant.id, contactId: contact.id, campaignId: campaign.id, status } }));
    }
    return { tenant, admin, campaign, contact, logs };
  }

  it('kill cancels queued/paused/draft/in-progress logs', async () => {
    const { tenant, admin, campaign } = await setupCampaignWithLogs(['queued', 'paused', 'draft', 'in-progress', 'completed']);
    const res = await request(app).post(`/api/campaigns/${campaign.id}/status`).set('Authorization', authHeader({ userId: admin.id, tenantId: tenant.id })).send({ action: 'kill' });
    expect(res.status).toBe(200);

    const logs = await prisma.callLog.findMany({ where: { campaignId: campaign.id } });
    const statuses = logs.map(l => l.status).sort();
    expect(statuses).toEqual(['cancelled', 'cancelled', 'cancelled', 'cancelled', 'completed']);
    expect(notifyWorkspaceMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'CAMPAIGN_KILLED' }));
  });

  it('pause only affects queued logs, not draft/completed', async () => {
    const { tenant, admin, campaign } = await setupCampaignWithLogs(['queued', 'draft', 'completed']);
    await request(app).post(`/api/campaigns/${campaign.id}/status`).set('Authorization', authHeader({ userId: admin.id, tenantId: tenant.id })).send({ action: 'pause' });

    const logs = await prisma.callLog.findMany({ where: { campaignId: campaign.id } });
    const byStatus = Object.fromEntries(logs.map(l => [l.id, l.status]));
    expect(Object.values(byStatus).sort()).toEqual(['completed', 'draft', 'paused']);
  });

  it('start moves draft logs to queued and enqueues calls', async () => {
    const { tenant, admin, campaign } = await setupCampaignWithLogs(['draft', 'draft']);
    const res = await request(app).post(`/api/campaigns/${campaign.id}/status`).set('Authorization', authHeader({ userId: admin.id, tenantId: tenant.id })).send({ action: 'start' });
    expect(res.status).toBe(200);

    const logs = await prisma.callLog.findMany({ where: { campaignId: campaign.id } });
    expect(logs.every(l => l.status === 'queued')).toBe(true);
    expect(enqueueCallMock).toHaveBeenCalledTimes(2);
  });

  it('rerun deletes non-terminal logs and re-queues fresh logs for all campaign contacts', async () => {
    const { tenant, admin, campaign, contact } = await setupCampaignWithLogs(['completed', 'failed']);
    // add a stray in-progress log that should be deleted on rerun
    await prisma.callLog.create({ data: { tenantId: tenant.id, contactId: contact.id, campaignId: campaign.id, status: 'in-progress' } });
    await prisma.campaignContact.create({ data: { campaignId: campaign.id, contactId: contact.id } });

    const res = await request(app).post(`/api/campaigns/${campaign.id}/status`).set('Authorization', authHeader({ userId: admin.id, tenantId: tenant.id })).send({ action: 'rerun' });
    expect(res.status).toBe(200);

    const logs = await prisma.callLog.findMany({ where: { campaignId: campaign.id } });
    // completed + failed preserved, in-progress deleted, one fresh queued log created
    const statuses = logs.map(l => l.status).sort();
    expect(statuses).toEqual(['completed', 'failed', 'queued']);
    expect(enqueueCallMock).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/campaigns/:campaignId/contacts — uploadContacts', () => {
  it('returns 404 for a nonexistent campaign', async () => {
    const tenant = await makeTenant();
    const admin = await makeUser('ADMIN');
    const res = await request(app).post('/api/campaigns/nonexistent/contacts').set('Authorization', authHeader({ userId: admin.id, tenantId: tenant.id })).send({ contacts: [] });
    expect(res.status).toBe(404);
  });

  it('creates contacts, campaignContacts, queued callLogs, and enqueues a call per unique contact', async () => {
    const tenant = await makeTenant();
    const callModule = await makeCallModule(tenant.id);
    const admin = await makeUser('ADMIN');
    const campaign = await prisma.campaign.create({ data: { name: 'Upload Test', tenantId: tenant.id, callModuleId: callModule.id, createdById: admin.id } });

    const res = await request(app).post(`/api/campaigns/${campaign.id}/contacts`).set('Authorization', authHeader({ userId: admin.id, tenantId: tenant.id })).send({
      contacts: [{ name: 'A', phone: '+1' }, { name: 'A2', phone: '+1' }, { name: 'B', phone: '+2' }],
    });

    expect(res.status).toBe(200);
    expect(res.body.contacts).toHaveLength(2);
    expect(enqueueCallMock).toHaveBeenCalledTimes(2);

    const callLogs = await prisma.callLog.findMany({ where: { campaignId: campaign.id } });
    expect(callLogs).toHaveLength(2);
    expect(callLogs.every(l => l.status === 'queued')).toBe(true);
  });
});
