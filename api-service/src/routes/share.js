import { Router } from 'express';
import { randomBytes } from 'crypto';
import { Readable } from 'stream';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../db.js';

const router = Router();

// POST /api/share/campaigns/:id — create share link (requires login)
router.post('/campaigns/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { validityDays = 7 } = req.body;

    const campaign = await prisma.campaign.findFirst({
      where: { id, tenantId: req.user.workspaceId }
    });
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);

    const link = await prisma.shareLink.create({
      data: { token, campaignId: id, tenantId: req.user.workspaceId, expiresAt }
    });

    res.json({ token: link.token, expiresAt: link.expiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: validate token and return share link or send 4xx
async function resolveToken(token, res) {
  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: { campaign: true }
  });
  if (!link) { res.status(404).json({ error: 'Share link not found' }); return null; }
  if (link.expiresAt < new Date()) { res.status(410).json({ error: 'Share link has expired' }); return null; }
  return link;
}

// GET /api/share/:token — campaign overview + contacts list (public)
// Queries CallReport (same source as the authenticated report page) so all evaluated calls appear.
// Falls back to CallLog for calls not yet evaluated.
router.get('/:token', async (req, res) => {
  try {
    const link = await resolveToken(req.params.token, res);
    if (!link) return;

    // Primary source: CallReport (covers all evaluated calls, with outcome/score/sentiment)
    const reports = await prisma.callReport.findMany({
      where: { campaignId: link.campaignId },
      select: {
        callLogId: true, contactName: true, outcome: true,
        score: true, sentiment: true, reportSummary: true,
        completionRate: true, createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Fetch matching CallLogs to get phone numbers and duration
    const callLogIds = reports.map(r => r.callLogId);
    const callLogs = await prisma.callLog.findMany({
      where: { id: { in: callLogIds } },
      include: { contact: true }
    });
    const clMap = Object.fromEntries(callLogs.map(cl => [cl.id, cl]));

    const contacts = reports.map(r => ({
      callLogId: r.callLogId,
      contactName: r.contactName || clMap[r.callLogId]?.contact?.name || 'Unknown',
      phone: clMap[r.callLogId]?.contact?.phone || '',
      status: clMap[r.callLogId]?.status || null,
      outcome: r.outcome,
      score: r.score ?? null,
      sentiment: r.sentiment || null,
      summary: r.reportSummary || null,
      createdAt: r.createdAt,
      durationMs: clMap[r.callLogId]?.durationMs || null
    }));

    res.json({
      campaign: {
        id: link.campaign.id,
        name: link.campaign.name,
        type: link.campaign.type,
        createdAt: link.campaign.createdAt
      },
      expiresAt: link.expiresAt,
      contacts
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/share/:token/calls/:callLogId — call detail (public)
router.get('/:token/calls/:callLogId', async (req, res) => {
  try {
    const link = await resolveToken(req.params.token, res);
    if (!link) return;

    // Verify the call belongs to this campaign via CallReport
    const report = await prisma.callReport.findFirst({
      where: { callLogId: req.params.callLogId, campaignId: link.campaignId }
    });
    if (!report) return res.status(404).json({ error: 'Call not found' });

    const callLog = await prisma.callLog.findUnique({
      where: { id: req.params.callLogId },
      include: { contact: true }
    });

    res.json({
      callLog: callLog ? {
        id: callLog.id,
        status: callLog.status,
        transcript: callLog.transcript,
        durationMs: callLog.durationMs,
        createdAt: callLog.createdAt,
        contact: callLog.contact,
        hasRecording: !!callLog.recordingUrl
      } : null,
      report
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/share/:token/calls/:callLogId/audio — proxy Twilio recording (public)
router.get('/:token/calls/:callLogId/audio', async (req, res) => {
  try {
    const link = await resolveToken(req.params.token, res);
    if (!link) return;

    // Verify via CallReport that this call belongs to the campaign
    const report = await prisma.callReport.findFirst({
      where: { callLogId: req.params.callLogId, campaignId: link.campaignId }
    });
    if (!report) return res.status(404).json({ error: 'Call not found' });

    const callLog = await prisma.callLog.findUnique({ where: { id: req.params.callLogId } });
    if (!callLog?.recordingUrl) return res.status(404).json({ error: 'No recording available' });

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const upstream = await fetch(callLog.recordingUrl, {
      headers: { Authorization: `Basic ${credentials}` }
    });

    if (!upstream.ok) return res.status(502).json({ error: 'Recording fetch failed' });

    res.set('Content-Type', 'audio/mpeg');
    res.set('Cache-Control', 'no-store');
    // Node 24 fetch returns Web Streams ReadableStream — convert before piping
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
