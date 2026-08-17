// src/server.js — HTTP server entrypoint
import app from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';

app.listen(config.port, () => {
  logger.info({ port: config.port }, '[Server] call-evaluation-service HTTP server running');
  logger.info({ url: `http://localhost:${config.port}/admin/queues` }, '[Server] BullMQ Board available');
});
