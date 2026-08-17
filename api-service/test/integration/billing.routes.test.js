import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const mockOrdersCreate = vi.fn();
vi.mock('razorpay', () => ({
  default: vi.fn().mockImplementation(() => ({
    orders: { create: mockOrdersCreate },
  })),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/db.js');
const { PACKS, LOW_BALANCE_THRESHOLD } = await import('../../src/config/billing.js');
const { deductCallMinutes } = await import('../../src/controllers/billing.controller.js');

process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test-razorpay-secret';
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'test-webhook-secret';

async function makeTenant(overrides = {}) {
  return prisma.tenant.create({
    data: { name: 'Billing Tenant', slug: 'billing-' + Date.now() + '-' + Math.random().toString(36).slice(2), ...overrides },
  });
}

function authHeaderFor(tenant, userId = 'user-1') {
  const token = jwt.sign(
    { id: userId, email: 'a@b.com', role: 'ADMIN', workspaceId: tenant.id, workspaceRole: 'ADMIN' },
    process.env.JWT_SECRET
  );
  return `Bearer ${token}`;
}

beforeEach(() => {
  mockOrdersCreate.mockReset();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/billing', () => {
  it('returns 401 with no auth header', async () => {
    const res = await request(app).get('/api/billing');
    expect(res.status).toBe(401);
  });

  it('returns balance, tier, limits and packs for the workspace', async () => {
    const tenant = await makeTenant({ minuteBalance: 250, billingTier: 'BASIC' });
    const res = await request(app).get('/api/billing').set('Authorization', authHeaderFor(tenant));
    expect(res.status).toBe(200);
    expect(res.body.minuteBalance).toBe(250);
    expect(res.body.billingTier).toBe('BASIC');
    expect(res.body.limits.teamMembers).toBe(5);
    expect(res.body.packs).toHaveLength(PACKS.length);
  });

  it('returns 404 when the workspace no longer exists', async () => {
    const token = jwt.sign(
      { id: 'u1', email: 'a@b.com', role: 'ADMIN', workspaceId: 'nonexistent-tenant', workspaceRole: 'ADMIN' },
      process.env.JWT_SECRET
    );
    const res = await request(app).get('/api/billing').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('GET /api/billing/history', () => {
  it('only returns SUCCESS top-ups, enriched with pack info', async () => {
    const tenant = await makeTenant();
    await prisma.topUp.create({ data: { tenantId: tenant.id, packId: 'BASIC', status: 'PENDING', razorpayOrderId: 'ord-pending-' + Date.now() } });
    await prisma.topUp.create({ data: { tenantId: tenant.id, packId: 'BASIC', status: 'SUCCESS', razorpayOrderId: 'ord-success-' + Date.now(), razorpayPaymentId: 'pay-1' } });

    const res = await request(app).get('/api/billing/history').set('Authorization', authHeaderFor(tenant));
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('SUCCESS');
    expect(res.body[0].packLabel).toBe('Basic');
  });
});

describe('POST /api/billing/order', () => {
  it('returns 400 for an invalid pack id', async () => {
    const tenant = await makeTenant();
    const res = await request(app).post('/api/billing/order').set('Authorization', authHeaderFor(tenant)).send({ packId: 'NOT_A_REAL_PACK' });
    expect(res.status).toBe(400);
  });

  it('creates a PENDING TopUp and calls Razorpay with the correct amount', async () => {
    const tenant = await makeTenant();
    mockOrdersCreate.mockResolvedValue({ id: 'order_abc123' });

    const res = await request(app).post('/api/billing/order').set('Authorization', authHeaderFor(tenant)).send({ packId: 'STANDARD' });
    expect(res.status).toBe(200);
    expect(res.body.orderId).toBe('order_abc123');
    expect(mockOrdersCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 500000, currency: 'INR' }));

    const stored = await prisma.topUp.findUnique({ where: { razorpayOrderId: 'order_abc123' } });
    expect(stored).toMatchObject({ tenantId: tenant.id, packId: 'STANDARD', status: 'PENDING' });
  });
});

describe('POST /api/billing/verify', () => {
  function signPayload(orderId, paymentId) {
    return crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  }

  it('returns 400 when fields are missing', async () => {
    const tenant = await makeTenant();
    const res = await request(app).post('/api/billing/verify').set('Authorization', authHeaderFor(tenant)).send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid signature', async () => {
    const tenant = await makeTenant();
    const res = await request(app).post('/api/billing/verify').set('Authorization', authHeaderFor(tenant))
      .send({ razorpayOrderId: 'o1', razorpayPaymentId: 'p1', razorpaySignature: 'not-a-real-signature' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when the order does not exist', async () => {
    const tenant = await makeTenant();
    const sig = signPayload('nonexistent-order', 'p1');
    const res = await request(app).post('/api/billing/verify').set('Authorization', authHeaderFor(tenant))
      .send({ razorpayOrderId: 'nonexistent-order', razorpayPaymentId: 'p1', razorpaySignature: sig });
    expect(res.status).toBe(404);
  });

  it('returns 403 when the order belongs to a different tenant', async () => {
    const tenant = await makeTenant();
    const otherTenant = await makeTenant();
    const orderId = 'order-cross-tenant-' + Date.now();
    await prisma.topUp.create({ data: { tenantId: otherTenant.id, packId: 'BASIC', status: 'PENDING', razorpayOrderId: orderId } });
    const sig = signPayload(orderId, 'p1');
    const res = await request(app).post('/api/billing/verify').set('Authorization', authHeaderFor(tenant))
      .send({ razorpayOrderId: orderId, razorpayPaymentId: 'p1', razorpaySignature: sig });
    expect(res.status).toBe(403);
  });

  it('is idempotent — returns alreadyCredited for an already-SUCCESS order without re-crediting', async () => {
    const tenant = await makeTenant({ minuteBalance: 50 });
    const orderId = 'order-already-success-' + Date.now();
    await prisma.topUp.create({ data: { tenantId: tenant.id, packId: 'BASIC', status: 'SUCCESS', razorpayOrderId: orderId, razorpayPaymentId: 'orig-payment' } });
    const sig = signPayload(orderId, 'p1');

    const res = await request(app).post('/api/billing/verify').set('Authorization', authHeaderFor(tenant))
      .send({ razorpayOrderId: orderId, razorpayPaymentId: 'p1', razorpaySignature: sig });
    expect(res.status).toBe(200);
    expect(res.body.alreadyCredited).toBe(true);

    const t = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(t.minuteBalance).toBe(50); // unchanged
  });

  it('credits the balance and updates tier + topUp status on a valid, new payment', async () => {
    const tenant = await makeTenant({ minuteBalance: 10, billingTier: 'TRIAL' });
    const orderId = 'order-credit-' + Date.now();
    await prisma.topUp.create({ data: { tenantId: tenant.id, packId: 'STANDARD', status: 'PENDING', razorpayOrderId: orderId } });
    const sig = signPayload(orderId, 'pay-new');

    const res = await request(app).post('/api/billing/verify').set('Authorization', authHeaderFor(tenant))
      .send({ razorpayOrderId: orderId, razorpayPaymentId: 'pay-new', razorpaySignature: sig });
    expect(res.status).toBe(200);
    expect(res.body.minutesAdded).toBe(1150);
    expect(res.body.tier).toBe('STANDARD');

    const t = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(t.minuteBalance).toBe(10 + 1150);
    expect(t.billingTier).toBe('STANDARD');

    const topUp = await prisma.topUp.findUnique({ where: { razorpayOrderId: orderId } });
    expect(topUp.status).toBe('SUCCESS');
    expect(topUp.razorpayPaymentId).toBe('pay-new');
  });
});

describe('POST /api/billing/webhook', () => {
  function signWebhookBody(body) {
    return crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(JSON.stringify(body)).digest('hex');
  }

  it('returns 400 for an invalid webhook signature', async () => {
    const res = await request(app).post('/api/billing/webhook').set('x-razorpay-signature', 'bad-sig').send({ event: 'payment.captured', payload: {} });
    expect(res.status).toBe(400);
  });

  it('credits balance on a valid payment.captured event for a pending order', async () => {
    const tenant = await makeTenant({ minuteBalance: 0, billingTier: 'TRIAL' });
    const orderId = 'order-webhook-' + Date.now();
    await prisma.topUp.create({ data: { tenantId: tenant.id, packId: 'BASIC', status: 'PENDING', razorpayOrderId: orderId } });

    const body = { event: 'payment.captured', payload: { payment: { entity: { order_id: orderId, id: 'pay-webhook-1' } } } };
    const sig = signWebhookBody(body);

    const res = await request(app).post('/api/billing/webhook').set('x-razorpay-signature', sig).send(body);
    expect(res.status).toBe(200);

    const t = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(t.minuteBalance).toBe(440); // BASIC pack minutes
    const topUp = await prisma.topUp.findUnique({ where: { razorpayOrderId: orderId } });
    expect(topUp.status).toBe('SUCCESS');
  });

  it('ignores events other than payment.captured', async () => {
    const body = { event: 'payment.failed', payload: {} };
    const sig = signWebhookBody(body);
    const res = await request(app).post('/api/billing/webhook').set('x-razorpay-signature', sig).send(body);
    expect(res.status).toBe(200);
  });

  it('does not double-credit an already-SUCCESS order', async () => {
    const tenant = await makeTenant({ minuteBalance: 999 });
    const orderId = 'order-webhook-dup-' + Date.now();
    await prisma.topUp.create({ data: { tenantId: tenant.id, packId: 'BASIC', status: 'SUCCESS', razorpayOrderId: orderId, razorpayPaymentId: 'orig' } });

    const body = { event: 'payment.captured', payload: { payment: { entity: { order_id: orderId, id: 'pay-dup' } } } };
    const sig = signWebhookBody(body);
    const res = await request(app).post('/api/billing/webhook').set('x-razorpay-signature', sig).send(body);
    expect(res.status).toBe(200);

    const t = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(t.minuteBalance).toBe(999); // unchanged, not double-credited
  });
});

describe('GET /api/billing/usage', () => {
  it('aggregates totalMinutes/totalCalls and applies contact-name overrides', async () => {
    const tenant = await makeTenant();
    const callModule = await prisma.callModule.create({ data: { name: 'Module', tenantId: tenant.id } });
    const campaign = await prisma.campaign.create({ data: { name: 'Usage Campaign', tenantId: tenant.id, callModuleId: callModule.id } });
    const contact = await prisma.contact.create({ data: { name: 'Original Name', phone: '+10000000000', tenantId: tenant.id } });
    await prisma.campaignContact.create({ data: { campaignId: campaign.id, contactId: contact.id, overrides: { name: 'Override Name' } } });
    await prisma.callLog.create({ data: { tenantId: tenant.id, contactId: contact.id, campaignId: campaign.id, status: 'completed', billableMinutes: 5 } });
    await prisma.callLog.create({ data: { tenantId: tenant.id, contactId: contact.id, campaignId: campaign.id, status: 'failed', billableMinutes: 2 } });

    const res = await request(app).get('/api/billing/usage').set('Authorization', authHeaderFor(tenant));
    expect(res.status).toBe(200);
    expect(res.body.totalMinutes).toBe(7);
    expect(res.body.totalCalls).toBe(2);
    expect(res.body.campaigns[0].completedCalls).toBe(1);
    expect(res.body.campaigns[0].calls.find(c => c.status === 'completed').contactName).toBe('Override Name');
  });
});

describe('deductCallMinutes (internal, invoked directly)', () => {
  it('does nothing when tenantId or durationMs is missing', async () => {
    await expect(deductCallMinutes(null, 60000)).resolves.toBeUndefined();
    await expect(deductCallMinutes('some-id', 0)).resolves.toBeUndefined();
  });

  it('deducts at least 1 minute for any call under a minute, floors at 0', async () => {
    const tenant = await makeTenant({ minuteBalance: 0 });
    const minutes = await deductCallMinutes(tenant.id, 5000); // 5s
    expect(minutes).toBe(1);
    const t = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(t.minuteBalance).toBe(0); // floored, not negative
  });

  it('deducts the correct rounded-up minutes for a longer call', async () => {
    const tenant = await makeTenant({ minuteBalance: 100 });
    const minutes = await deductCallMinutes(tenant.id, 125000); // 2m5s -> 3 billable minutes
    expect(minutes).toBe(3);
    const t = await prisma.tenant.findUnique({ where: { id: tenant.id } });
    expect(t.minuteBalance).toBe(97);
  });

  it('sends a BALANCE_DEPLETED notification to admins when balance hits exactly 0', async () => {
    const tenant = await makeTenant({ minuteBalance: 1 });
    const admin = await prisma.user.create({ data: { email: `admin-${Date.now()}@test.com`, name: 'Admin', passwordHash: 'x' } });
    await prisma.workspaceMember.create({ data: { userId: admin.id, tenantId: tenant.id, role: 'ADMIN' } });

    await deductCallMinutes(tenant.id, 60000); // exactly 1 minute -> balance goes to 0
    const notifications = await prisma.notification.findMany({ where: { tenantId: tenant.id, type: 'BALANCE_DEPLETED' } });
    expect(notifications).toHaveLength(1);
  });

  it(`sends a BALANCE_LOW notification when balance drops to <= ${LOW_BALANCE_THRESHOLD} but not 0`, async () => {
    const tenant = await makeTenant({ minuteBalance: LOW_BALANCE_THRESHOLD + 1 });
    const admin = await prisma.user.create({ data: { email: `admin2-${Date.now()}@test.com`, name: 'Admin', passwordHash: 'x' } });
    await prisma.workspaceMember.create({ data: { userId: admin.id, tenantId: tenant.id, role: 'ADMIN' } });

    await deductCallMinutes(tenant.id, 60000); // drops to exactly LOW_BALANCE_THRESHOLD
    const notifications = await prisma.notification.findMany({ where: { tenantId: tenant.id, type: 'BALANCE_LOW' } });
    expect(notifications).toHaveLength(1);
  });

  it('sends no notification when balance stays well above the threshold', async () => {
    const tenant = await makeTenant({ minuteBalance: 1000 });
    const admin = await prisma.user.create({ data: { email: `admin3-${Date.now()}@test.com`, name: 'Admin', passwordHash: 'x' } });
    await prisma.workspaceMember.create({ data: { userId: admin.id, tenantId: tenant.id, role: 'ADMIN' } });

    await deductCallMinutes(tenant.id, 60000);
    const notifications = await prisma.notification.findMany({ where: { tenantId: tenant.id } });
    expect(notifications).toHaveLength(0);
  });
});
