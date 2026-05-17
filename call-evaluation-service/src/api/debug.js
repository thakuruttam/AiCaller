// src/api/debug.js — GET /debug/* — observability endpoints (no auth needed for internal use)
import { Router }  from 'express';
import { prisma }  from '../db.js';
import { allQueues } from '../queues/index.js';

export const debugRouter = Router();

// Full ReportJob stage statuses for a call
debugRouter.get('/job/:callLogId', async (req, res) => {
  try {
    const job = await prisma.reportJob.findUnique({ where: { callLogId: req.params.callLogId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Full raw CallReport (all fields, no omissions)
debugRouter.get('/report/:callLogId', async (req, res) => {
  try {
    const report = await prisma.callReport.findUnique({ where: { callLogId: req.params.callLogId } });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Live queue depths for all queues
debugRouter.get('/queue-stats', async (_req, res) => {
  try {
    const stats = {};
    for (const q of allQueues) {
      stats[q.name] = await q.getJobCounts('waiting', 'active', 'delayed', 'failed', 'completed');
    }
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DLQ entries (paginated)
debugRouter.get('/dlq', async (req, res) => {
  try {
    const { page = '1', limit = '20', stage, retried } = req.query;
    const where = {
      ...(stage   && { stage }),
      ...(retried !== undefined && { retried: retried === 'true' })
    };
    const [entries, total] = await Promise.all([
      prisma.dLQEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.dLQEntry.count({ where })
    ]);
    res.json({ entries, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Single DLQ entry with full stacktrace
debugRouter.get('/dlq/:id', async (req, res) => {
  try {
    const entry = await prisma.dLQEntry.findUnique({ where: { id: req.params.id } });
    if (!entry) return res.status(404).json({ error: 'DLQ entry not found' });
    res.json(entry);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
