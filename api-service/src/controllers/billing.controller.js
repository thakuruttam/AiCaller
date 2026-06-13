import Razorpay from 'razorpay';
import crypto from 'crypto';
import { prisma } from '../db.js';
import { PACKS, TIER_LIMITS, LOW_BALANCE_THRESHOLD } from '../config/billing.js';
import { createNotification } from '../utils/notifications.js';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// GET /api/billing
export async function getBilling(req, res) {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.workspaceId },
      select: { minuteBalance: true, billingTier: true },
    });
    if (!tenant) return res.status(404).json({ error: 'Workspace not found' });

    res.json({
      minuteBalance: tenant.minuteBalance,
      billingTier: tenant.billingTier,
      limits: TIER_LIMITS[tenant.billingTier],
      packs: PACKS,
    });
  } catch (err) {
    console.error('[billing] getBilling error:', err);
    res.status(500).json({ error: 'Failed to fetch billing info' });
  }
}

// GET /api/billing/history
// No financial data from DB — derive pack details from config using packId
export async function getHistory(req, res) {
  try {
    const topUps = await prisma.topUp.findMany({
      where: { tenantId: req.user.workspaceId, status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, packId: true, razorpayPaymentId: true, status: true, createdAt: true },
    });

    const enriched = topUps.map(t => {
      const pack = PACKS.find(p => p.id === t.packId) || {};
      return {
        id: t.id,
        packId: t.packId,
        packLabel: pack.label || t.packId,
        displayAmount: pack.displayAmount || '—',
        minutes: pack.minutes || 0,
        tierUnlocked: pack.tier || '—',
        razorpayPaymentId: t.razorpayPaymentId,
        status: t.status,
        createdAt: t.createdAt,
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error('[billing] getHistory error:', err);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
}

// POST /api/billing/order  { packId }
export async function createOrder(req, res) {
  const { packId } = req.body;
  const pack = PACKS.find(p => p.id === packId);
  if (!pack) return res.status(400).json({ error: 'Invalid pack' });

  try {
    const order = await razorpay.orders.create({
      amount: pack.amountPaise,
      currency: 'INR',
      receipt: `topup_${req.user.workspaceId}_${Date.now()}`,
      notes: { workspaceId: req.user.workspaceId, packId, userId: req.user.id },
    });

    // Store only the order reference — no financial data
    await prisma.topUp.create({
      data: {
        tenantId: req.user.workspaceId,
        packId,
        razorpayOrderId: order.id,
        status: 'PENDING',
      },
    });

    res.json({
      orderId: order.id,
      amount: pack.amountPaise,
      currency: 'INR',
      packLabel: pack.label,
    });
  } catch (err) {
    console.error('[billing] createOrder error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
}

// POST /api/billing/verify  { razorpayOrderId, razorpayPaymentId, razorpaySignature }
export async function verifyPayment(req, res) {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ error: 'Missing payment fields' });
  }

  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSig !== razorpaySignature) {
    return res.status(400).json({ error: 'Invalid payment signature' });
  }

  try {
    const topUp = await prisma.topUp.findUnique({ where: { razorpayOrderId } });
    if (!topUp) return res.status(404).json({ error: 'Order not found' });
    if (topUp.status === 'SUCCESS') return res.json({ ok: true, alreadyCredited: true });
    if (topUp.tenantId !== req.user.workspaceId) return res.status(403).json({ error: 'Forbidden' });

    const pack = PACKS.find(p => p.id === topUp.packId);
    if (!pack) return res.status(400).json({ error: 'Unknown pack' });

    await creditBalance({ topUp, razorpayPaymentId, pack });

    res.json({ ok: true, minutesAdded: pack.minutes, tier: pack.tier });
  } catch (err) {
    console.error('[billing] verifyPayment error:', err);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
}

// POST /api/billing/webhook  (Razorpay server-to-server)
export async function razorpayWebhook(req, res) {
  const sig = req.headers['x-razorpay-signature'];
  const body = JSON.stringify(req.body);

  const expectedSig = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  if (expectedSig !== sig) return res.status(400).json({ error: 'Invalid webhook signature' });

  const { event, payload } = req.body;

  if (event === 'payment.captured') {
    const payment = payload.payment.entity;
    try {
      const topUp = await prisma.topUp.findUnique({ where: { razorpayOrderId: payment.order_id } });
      if (topUp && topUp.status !== 'SUCCESS') {
        const pack = PACKS.find(p => p.id === topUp.packId);
        if (pack) await creditBalance({ topUp, razorpayPaymentId: payment.id, pack });
      }
    } catch (err) {
      console.error('[billing] webhook error:', err);
    }
  }

  res.json({ ok: true });
}

// ── Internal only — the ONLY function that can credit balance ────────────────
// Not exported as an API endpoint. Called exclusively from verifyPayment and razorpayWebhook.
async function creditBalance({ topUp, razorpayPaymentId, pack }) {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      UPDATE "Tenant"
      SET "minuteBalance" = "minuteBalance" + ${pack.minutes},
          "billingTier"   = ${pack.tier}::"BillingTier"
      WHERE id = ${topUp.tenantId}
    `;

    await tx.topUp.update({
      where: { id: topUp.id },
      data: { status: 'SUCCESS', razorpayPaymentId },
    });
  });

  try {
    const members = await prisma.workspaceMember.findMany({
      where: { tenantId: topUp.tenantId, role: 'ADMIN' },
    });
    for (const m of members) {
      await createNotification({
        userId: m.userId,
        tenantId: topUp.tenantId,
        type: 'TOPUP_SUCCESS',
        title: 'Credits added',
        body: `${pack.minutes} minutes added (${pack.displayAmount})`,
        link: '/billing',
      });
    }
  } catch (err) {
    console.error('[billing] notification error:', err);
  }
}

// GET /api/billing/usage
export async function getUsage(req, res) {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { tenantId: req.user.workspaceId },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        campaignContacts: {
          select: { contactId: true, overrides: true },
        },
        callLogs: {
          select: {
            id: true,
            status: true,
            durationMs: true,
            billableMinutes: true,
            createdAt: true,
            contactId: true,
            contact: { select: { name: true, phone: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = campaigns.map(c => {
      // Build a contactId → campaign-specific name map from overrides
      const nameOverride = Object.fromEntries(
        c.campaignContacts
          .filter(cc => cc.overrides?.name)
          .map(cc => [cc.contactId, cc.overrides.name])
      );

      const totalMinutes = c.callLogs.reduce((s, l) => s + (l.billableMinutes || 0), 0);
      const completedCalls = c.callLogs.filter(l => l.status === 'completed').length;
      return {
        id: c.id,
        name: c.name,
        type: c.type,
        createdAt: c.createdAt,
        totalCalls: c.callLogs.length,
        completedCalls,
        totalMinutes,
        calls: c.callLogs.map(l => ({
          id: l.id,
          contactName: nameOverride[l.contactId] || l.contact?.name || '—',
          contactPhone: l.contact?.phone || '—',
          status: l.status,
          durationMs: l.durationMs || 0,
          billableMinutes: l.billableMinutes || 0,
          createdAt: l.createdAt,
        })),
      };
    });

    res.json({
      campaigns: enriched,
      totalMinutes: enriched.reduce((s, c) => s + c.totalMinutes, 0),
      totalCalls: enriched.reduce((s, c) => s + c.totalCalls, 0),
    });
  } catch (err) {
    console.error('[billing] getUsage error:', err);
    res.status(500).json({ error: 'Failed to fetch usage' });
  }
}

// ── Called from telephony gateway after call ends ────────────────────────────
// Not an API endpoint — invoked internally only.
export async function deductCallMinutes(tenantId, durationMs) {
  if (!tenantId || !durationMs) return;
  const billableMinutes = Math.max(1, Math.ceil(durationMs / 60000));

  await prisma.$executeRaw`
    UPDATE "Tenant"
    SET "minuteBalance" = GREATEST(0, "minuteBalance" - ${billableMinutes})
    WHERE id = ${tenantId}
  `;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { minuteBalance: true },
  });

  if (tenant?.minuteBalance === 0) {
    await notifyAdmins(tenantId, 'BALANCE_DEPLETED', 'Balance depleted',
      'Your minute balance has run out. Top up to resume calling.', '/billing');
  } else if (tenant?.minuteBalance <= LOW_BALANCE_THRESHOLD) {
    await notifyAdmins(tenantId, 'BALANCE_LOW', 'Low balance warning',
      `Only ${tenant.minuteBalance} minutes remaining.`, '/billing');
  }

  return billableMinutes;
}

async function notifyAdmins(tenantId, type, title, body, link) {
  try {
    const members = await prisma.workspaceMember.findMany({ where: { tenantId, role: 'ADMIN' } });
    for (const m of members) {
      await createNotification({ userId: m.userId, tenantId, type, title, body, link });
    }
  } catch (err) {
    console.error('[billing] notifyAdmins error:', err);
  }
}
