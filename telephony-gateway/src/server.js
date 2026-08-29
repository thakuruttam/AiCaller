// telephony-gateway/src/server.js
import 'dotenv/config';
import express from 'express';
import http from 'http';
import { plivoCallbackRouter } from './plivoCallbackHandler.js';
import { setupPlivoStream } from './plivoStreamHandler.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'telephony-gateway' }));

// Plivo routes — /answer (returns <Stream> XML), /status (hangup_url), /recording
app.use('/call', plivoCallbackRouter);
console.log('[telephony-gateway] Plivo streaming mode active — Sarvam AI STT via Media Streams');

const PORT = process.env.TELEPHONY_PORT || 3001;
const server = http.createServer(app);

const plivoWss = setupPlivoStream();

let draining = false;

server.on('upgrade', (req, socket, head) => {
  const pathname = (req.url || '').split('?')[0];
  if (draining) {
    // A deploy is in progress — refuse new calls outright rather than accept
    // one we're about to kill. Plivo's caller just gets no answer instead of
    // a call that connects and then goes silent mid-conversation.
    console.log('[telephony-gateway] Refusing new call — shutting down for deploy');
    socket.destroy();
    return;
  }
  if (pathname === '/plivo-streams') {
    plivoWss.handleUpgrade(req, socket, head, (ws) => plivoWss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`[telephony-gateway] Listening on port ${PORT}`);
});

// Graceful shutdown — `docker stop` sends SIGTERM straight into every deploy,
// and with no handling here that hard-killed the process instantly,
// including any live call mid-conversation (the bot going silent with no
// error, and no chance for hangupCall() or saveTranscript() to ever run).
// Stop accepting new calls immediately, but let already-connected calls run
// to completion (or up to SHUTDOWN_GRACE_MS) before exiting — paired with
// raising docker stop's own timeout on the host so it doesn't SIGKILL first.
const SHUTDOWN_GRACE_MS = parseInt(process.env.SHUTDOWN_GRACE_MS || '90000', 10);

function gracefulShutdown(signal) {
  if (draining) return;
  draining = true;

  const activeCalls = plivoWss.clients.size;
  console.log(`[telephony-gateway] ${signal} received — draining ${activeCalls} active call(s), grace window ${SHUTDOWN_GRACE_MS}ms`);

  server.close(() => {
    console.log('[telephony-gateway] HTTP server closed — no longer accepting new connections');
  });

  if (activeCalls === 0) {
    process.exit(0);
    return;
  }

  const forceExitTimer = setTimeout(() => {
    console.warn(`[telephony-gateway] Grace period elapsed with ${plivoWss.clients.size} call(s) still active — forcing exit`);
    process.exit(0);
  }, SHUTDOWN_GRACE_MS);
  forceExitTimer.unref();

  const drainCheck = setInterval(() => {
    if (plivoWss.clients.size === 0) {
      clearInterval(drainCheck);
      clearTimeout(forceExitTimer);
      console.log('[telephony-gateway] All calls finished — exiting cleanly');
      process.exit(0);
    }
  }, 1000);
  drainCheck.unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
