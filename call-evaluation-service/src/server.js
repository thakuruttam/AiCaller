// src/server.js — HTTP server: BullMQ Board + Debug + Admin + Reports API
import 'dotenv/config';
import express              from 'express';
import { createBullBoard }  from '@bull-board/api';
import { BullMQAdapter }    from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter }   from '@bull-board/express';
import { config }           from './config.js';
import { logger }           from './logger.js';
import { allQueues }        from './queues/index.js';
import { reportsRouter }    from './api/reports.js';
import { debugRouter }      from './api/debug.js';
import { adminRouter }      from './api/admin.js';
import cors                 from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// ── BullMQ Board (live queue UI) ─────────────────────────────────────
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: allQueues.map(q => new BullMQAdapter(q)),
  serverAdapter
});

// Simple API key guard for admin UI
app.use('/admin/queues', (req, res, next) => {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (key !== config.adminApiKey) return res.status(401).json({ error: 'Unauthorized' });
  next();
}, serverAdapter.getRouter());

// ── Health ────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const queueStats = {};
  for (const q of allQueues) {
    const counts = await q.getJobCounts('waiting', 'active', 'failed', 'completed');
    queueStats[q.name] = counts;
  }
  res.json({ status: 'ok', queues: queueStats, ts: new Date().toISOString() });
});

// ── API routers ───────────────────────────────────────────────────────
app.use('/reports', reportsRouter);
app.use('/debug',   debugRouter);
app.use('/admin',   adminRouter);

app.listen(config.port, () => {
  logger.info({ port: config.port }, '[Server] call-evaluation-service HTTP server running');
  logger.info({ url: `http://localhost:${config.port}/admin/queues` }, '[Server] BullMQ Board available');
});
