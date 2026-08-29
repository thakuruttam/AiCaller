// telephony-gateway/src/plivoCallbackHandler.js
//
// Plivo REST webhooks:
//   POST /call/answer    — call connects, return <Stream> XML pointing at the
//                          bidirectional WebSocket (plivoStreamHandler.js does
//                          the actual conversation).
//   POST /call/status    — Plivo's hangup_url, fires once when the call ends.
//                          Saves transcript is already handled by the stream's
//                          'stop' event; this just finalizes anything stuck if
//                          the stream closed without a clean 'stop' (e.g. Plivo
//                          killed the WS abruptly).
//   POST /call/recording — Plivo's recording callback_url, fires when the MP3
//                          is ready (recording is started from the WS 'start'
//                          handler once the real call_uuid is known).

import express from 'express';
import { prisma } from './db.js';
import { enqueueCall } from './queues/callQueue.js';

const router = express.Router();
router.use(express.urlencoded({ extended: false }));

const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');

// Plivo's hangup_url CallStatus values that mean the callee was never actually
// reached — retryable per campaign settings. 'completed' always means the
// stream connected (handled separately via the WS 'stop' event), so it's
// deliberately excluded here.
const RETRYABLE_CALL_STATUSES = new Set(['busy', 'no-answer', 'failed', 'canceled']);
const RETRY_DELAY_MS = 20 * 60 * 1000; // 20 min — long enough to be reasonable after a busy/no-answer/decline, short enough to still be same-day useful.

async function maybeScheduleRetry(callLog) {
  if (!callLog.campaignId) return; // not tied to a campaign — nothing to read retryAttempts from
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: callLog.campaignId },
      select: { callSettings: true }
    });
    const maxRetries = campaign?.callSettings?.retryAttempts ?? 0;
    if (maxRetries <= 0) return;

    // Count real attempts only — the 'draft' call log created when a contact
    // is first added to a campaign isn't an attempt and would otherwise
    // silently eat into the retry budget.
    const attemptsSoFar = await prisma.callLog.count({
      where: { campaignId: callLog.campaignId, contactId: callLog.contactId, status: { not: 'draft' } }
    });
    if (attemptsSoFar >= 1 + maxRetries) return;

    const contact = await prisma.contact.findUnique({ where: { id: callLog.contactId }, select: { phone: true } });
    if (!contact?.phone) return;

    const newCallLog = await prisma.callLog.create({
      data: { tenantId: callLog.tenantId, contactId: callLog.contactId, campaignId: callLog.campaignId, status: 'queued' }
    });

    await enqueueCall(callLog.tenantId, {
      callLogId: newCallLog.id,
      phone: contact.phone,
      contactId: callLog.contactId,
      campaignId: callLog.campaignId
    }, { delay: RETRY_DELAY_MS });

    console.log(`[Plivo] Scheduled retry ${attemptsSoFar + 1}/${1 + maxRetries} for contact ${callLog.contactId} in ${RETRY_DELAY_MS / 60000}min`);
  } catch (err) {
    console.error('[Plivo] maybeScheduleRetry error:', err);
  }
}

router.post('/answer', (req, res) => {
  const campaignId = req.query.campaignId || '';
  const callLogId  = req.query.callLogId  || '';
  const wsUrl = `${baseUrl.replace(/^https?/, 'wss')}/plivo-streams?campaignId=${encodeURIComponent(campaignId)}&callLogId=${encodeURIComponent(callLogId)}`;
  // '&' must be escaped as '&amp;' inside XML element content — a bare '&' in
  // the query string here makes Plivo reject the whole response as invalid
  // XML (HangupCauseName=Invalid Answer XML) and hang up immediately.
  const xmlSafeUrl = wsUrl.replace(/&/g, '&amp;');

  res.type('text/xml').send(
    `<Response><Stream bidirectional="true" keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">${xmlSafeUrl}</Stream></Response>`
  );
});

// Plivo's hangup_url — CallUUID / CallStatus / HangupCause are form fields.
router.post('/status', async (req, res) => {
  res.sendStatus(200); // ack immediately

  const { CallUUID: callSid, CallStatus } = req.body;
  if (!callSid) return;

  try {
    // The stream handler's 'stop' event is the primary place transcript/eval
    // get finalized, for calls that actually connected — this only matters
    // for calls that never got a WS stream at all (still 'in-progress' here
    // means the bidirectional stream never opened, i.e. the callee was never
    // reached), or whose WS was terminated abruptly without a clean 'stop'.
    const callLog = await prisma.callLog.findFirst({
      where: { providerRef: callSid },
      select: { id: true, status: true, campaignId: true, contactId: true, tenantId: true }
    });
    if (!callLog || callLog.status !== 'in-progress') return;

    const isFailure = RETRYABLE_CALL_STATUSES.has((CallStatus || '').toLowerCase());
    const finalStatus = isFailure ? 'failed' : 'completed';

    await prisma.callLog.update({
      where: { id: callLog.id },
      data:  { status: finalStatus }
    });
    console.log(`[Plivo] /status: callLog ${callLog.id} → ${finalStatus} (CallStatus=${CallStatus})`);

    if (isFailure) {
      await maybeScheduleRetry(callLog);
    }
  } catch (err) {
    console.error('[Plivo] /status error:', err);
  }
});

router.post('/recording', async (req, res) => {
  res.sendStatus(200);
  const { call_uuid: callSid, record_url: recordUrl, recording_duration_ms: durationMs } = req.body;
  if (!callSid || !recordUrl) return;

  try {
    const callLog = await prisma.callLog.findFirst({
      where: { providerRef: callSid }, select: { id: true, durationMs: true }
    });
    if (!callLog) return;

    const recordingDurationMs = parseInt(durationMs || '0', 10);

    await prisma.callLog.update({
      where: { id: callLog.id },
      data: {
        recordingUrl: recordUrl,
        // The wall-clock duration saveTranscript() computes from callStartTime
        // (plivoStreamHandler.js) is the accurate source and arrives first in
        // the common case — don't let this webhook (which can land after it,
        // and whose recording_duration_ms used to be truncated to Plivo's 60s
        // recording default) clobber it. Only fall back here for calls whose
        // WS stream never got a clean 'stop' event.
        ...(!callLog.durationMs && recordingDurationMs > 0 ? { durationMs: recordingDurationMs } : {})
      }
    });
    console.log(`[Plivo] Recording ready for ${callSid} — ${recordUrl}`);
  } catch (err) {
    console.error('[Plivo] /recording error:', err);
  }
});

export { router as plivoCallbackRouter };
