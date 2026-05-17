// telephony-gateway/src/server.js
import 'dotenv/config';
import express from 'express';
import http from 'http';
import { setupTwilioStream } from './twilioStreamHandler.js';

const app = express();

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'telephony-gateway' }));

const PORT = process.env.PORT || 3001;
const httpServer = http.createServer(app);

// Attach Twilio WebSocket stream handler
setupTwilioStream(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[telephony-gateway] Listening on port ${PORT}`);
});
