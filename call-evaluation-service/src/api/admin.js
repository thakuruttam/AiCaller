// src/api/admin.js — POST /admin/* — retry, reprocess, DLQ management
import { Router }  from 'express';
import { prisma }  from '../db.js';
import { config }  from '../config.js';
import { logger }  from '../logger.js';
import { getTenantIngestQueue } from '../queues/index.js';

export const adminRouter = Router();

// API key guard for all admin routes
adminRouter.use((req, res, next) => {
  const key = req.headers['x-admin-key'];
  if (key !== config.adminApiKey) return res.status(401).json({ error: 'Unauthorized' });
  next();
});

// Re-run full pipeline for a call (reprocess, lower priority)
adminRouter.post('/retry/:callLogId', async (req, res) => {
  try {
    const { callLogId } = req.params;
    const report = await prisma.callReport.findUnique({ where: { callLogId } });
    if (!report) return res.status(404).json({ error: 'Call report not found' });

    // Fetch the original job payload from DLQ or rebuild from report
    const ingestQueue = getTenantIngestQueue(report.tenantId);
    await ingestQueue.add('CALL_COMPLETED', { callLogId, ...report }, { priority: 10 });
    logger.info({ callLogId }, '[Admin] Reprocess queued');
    res.json({ message: 'Reprocess queued', callLogId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Retry a single DLQ entry
adminRouter.post('/dlq/:id/retry', async (req, res) => {
  try {
    const entry = await prisma.dLQEntry.findUnique({ where: { id: req.params.id } });
    if (!entry) return res.status(404).json({ error: 'DLQ entry not found' });
    if (!entry.canRetry) return res.status(400).json({ error: 'Entry marked as non-retryable' });

    const tenantId = entry.payload?.tenantId || 'default';
    const ingestQueue = getTenantIngestQueue(tenantId);
    await ingestQueue.add('CALL_COMPLETED', entry.payload, { priority: 10 });
    await prisma.dLQEntry.update({ where: { id: entry.id }, data: { retried: true } });

    logger.info({ dlqId: entry.id, callLogId: entry.callLogId }, '[Admin] DLQ entry retried');
    res.json({ message: 'DLQ entry queued for retry' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Retry ALL retryable DLQ entries
adminRouter.post('/dlq/retry-all', async (req, res) => {
  try {
    const entries = await prisma.dLQEntry.findMany({ where: { canRetry: true, retried: false } });
    for (const entry of entries) {
      const tenantId = entry.payload?.tenantId || 'default';
      const ingestQueue = getTenantIngestQueue(tenantId);
      await ingestQueue.add('CALL_COMPLETED', entry.payload, { priority: 10 });
      await prisma.dLQEntry.update({ where: { id: entry.id }, data: { retried: true } });
    }
    logger.info({ count: entries.length }, '[Admin] DLQ retry-all queued');
    res.json({ message: `${entries.length} DLQ entries queued for retry` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark DLQ entry as permanently dead
adminRouter.delete('/dlq/:id', async (req, res) => {
  try {
    await prisma.dLQEntry.update({
      where: { id: req.params.id },
      data: { canRetry: false }
    });
    res.json({ message: 'Marked as permanently dead' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
