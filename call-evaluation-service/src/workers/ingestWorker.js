// src/workers/ingestWorker.js — Fair Ingest Dispatcher for per-tenant evaluation
import { config }                 from '../config.js';
import { logger }                 from '../logger.js';
import { prisma }                 from '../db.js';
import { QUEUES, enqueueEvaluation, getTenantIngestQueue } from '../queues/index.js';

import { Worker } from 'bullmq';

const tenantWorkers = new Map();

function getTenantWorker(tenantId) {
  if (!tenantWorkers.has(tenantId)) {
    logger.info({ tenantId }, '[Ingest] Spawning worker for tenant');
    const worker = new Worker(`report.ingest-${tenantId}`, async (job) => {
      return await processIngestJob(job, tenantId);
    }, { 
      connection: config.redis,
      concurrency: 5 // allow processing multiple evaluations in parallel per tenant
    });

    worker.on('error', err => {
      logger.error({ tenantId, err: err.message }, '[IngestWorker error]');
    });

    tenantWorkers.set(tenantId, worker);
  }
  return tenantWorkers.get(tenantId);
}

export function startIngestWorker() {
  logger.info('[Worker] Fair Ingest Dispatcher started');

  async function tick() {
    try {
      const tenantIds = await config.redis.smembers('active:eval:tenants');

      for (const tenantId of tenantIds) {
        getTenantWorker(tenantId);
      }
    } catch (err) {
      logger.error({ err: err.message }, '[IngestWorker] Tick error');
    }

    setTimeout(tick, 5000); // Check for new tenants every 5 seconds
  }

  tick();
  
  return {
    close: async () => {
      for (const worker of tenantWorkers.values()) {
        await worker.close();
      }
    } 
  };
}

async function processIngestJob(job, tenantId) {
  const { callLogId, campaignId, contactName, priority = 1 } = job.data;

  try {
    logger.info({ callLogId, campaignId, tenantId }, '[Ingest] CALL_COMPLETED received');

    // Create a placeholder CallReport first so the ReportJob FK resolves
    await prisma.callReport.upsert({
      where:  { callLogId },
      create: { callLogId, campaignId, tenantId, contactName },
      update: {}
    });

    // Create or reset ReportJob for observability
    await prisma.reportJob.upsert({
      where: { callLogId },
      create: {
        callLogId,
        ingestStatus:     'done',
        normalizeStatus:  'pending',
        extractStatus:    'pending',
        evaluateStatus:   'pending',
        complianceStatus: 'pending',
        assembleStatus:   'pending',
        priority,
        startedAt: new Date()
      },
      update: {
        ingestStatus:     'done',
        normalizeStatus:  'pending',
        extractStatus:    'pending',
        evaluateStatus:   'pending',
        complianceStatus: 'pending',
        assembleStatus:   'pending',
        lastError:        null,
        completedAt:      null,
        priority
      }
    });

    // Launch the BullMQ Flow pipeline
    await enqueueEvaluation(callLogId, job.data, priority);
    logger.info({ callLogId }, '[Ingest] Flow launched');
  } catch (err) {
    logger.error({ callLogId, err: err.message }, '[Ingest] Failed');
    throw err; // ensure BullMQ marks job as failed
  }
}
