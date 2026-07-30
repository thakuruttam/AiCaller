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

server.on('upgrade', (req, socket, head) => {
  const pathname = (req.url || '').split('?')[0];
  if (pathname === '/plivo-streams') {
    plivoWss.handleUpgrade(req, socket, head, (ws) => plivoWss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`[telephony-gateway] Listening on port ${PORT}`);
});
