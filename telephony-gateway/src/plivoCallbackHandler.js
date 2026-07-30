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

const router = express.Router();
router.use(express.urlencoded({ extended: false }));

const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');

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

  const { CallUUID: callSid } = req.body;
  if (!callSid) return;

  try {
    // The stream handler's 'stop' event is the primary place transcript/eval
    // get finalized. This is just a safety net for calls whose WS never got
    // a clean 'stop' (e.g. Plivo terminated the socket abruptly).
    const callLog = await prisma.callLog.findFirst({
      where: { providerRef: callSid },
      select: { id: true, status: true }
    });
    if (callLog && callLog.status === 'in-progress') {
      await prisma.callLog.update({
        where: { id: callLog.id },
        data:  { status: 'completed' }
      });
      console.log(`[Plivo] /status: force-completed callLog ${callLog.id} (WS 'stop' never fired)`);
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
      where: { providerRef: callSid }, select: { id: true }
    });
    if (!callLog) return;

    await prisma.callLog.update({
      where: { id: callLog.id },
      data:  { recordingUrl: recordUrl, durationMs: parseInt(durationMs || '0', 10) }
    });
    console.log(`[Plivo] Recording ready for ${callSid} — ${recordUrl}`);
  } catch (err) {
    console.error('[Plivo] /recording error:', err);
  }
});

export { router as plivoCallbackRouter };
