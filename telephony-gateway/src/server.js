// telephony-gateway/src/server.js
import 'dotenv/config';
import express from 'express';
import http from 'http';
import { twilioGatherRouter } from './twilioGatherHandler.js';
import { setupTwilioStream } from './twilioStreamHandler.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'telephony-gateway' }));

const USE_STREAMING = !!(process.env.SARVAM_API_KEY || process.env.USE_STREAMING === 'true');

if (USE_STREAMING) {
  // ── Streaming path (Sarvam AI via Twilio Media Streams) ─────────────
  // /call/answer returns <Connect><Stream> so Twilio sends raw audio over WebSocket.
  // /call/status and /call/recording are still handled by the gather router
  // (they save transcripts + queue eval — same logic either way).
  const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
  app.post('/call/answer', (req, res) => {
    const campaignId = req.query.campaignId || '';
    const callLogId  = req.query.callLogId  || '';
    const wsUrl = baseUrl.replace(/^https?/, 'wss') + '/streams';
    // customParameters are received by twilioStreamHandler in msg.start.customParameters
    res.type('text/xml').send(`<Response><Connect><Stream url="${wsUrl}"><Parameter name="campaignId" value="${campaignId}"/><Parameter name="callLogId" value="${callLogId}"/></Stream></Connect></Response>`);
  });
  // Mount the full gather router AFTER the specific /answer route so all other
  // /call/* paths (status, recording) are still handled correctly.
  app.use('/call', twilioGatherRouter);
  console.log('[telephony-gateway] Streaming mode active — Sarvam AI STT via Media Streams');
} else {
  // ── REST Gather path (Twilio built-in STT) ───────────────────────────
  app.use('/call', twilioGatherRouter);
  console.log('[telephony-gateway] Gather mode active — Twilio built-in STT');
}

const PORT = process.env.TELEPHONY_PORT || 3001;
const server = http.createServer(app);

if (USE_STREAMING) {
  setupTwilioStream(server);
}

server.listen(PORT, () => {
  console.log(`[telephony-gateway] Listening on port ${PORT}`);
});
