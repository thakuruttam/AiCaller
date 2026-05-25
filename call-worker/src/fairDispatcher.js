// call-worker/src/fairDispatcher.js
import { Worker } from 'bullmq';
import { redis } from './redis.js';
import { prisma } from './db.js';
import { processOutboundCall } from './telephony/telephonyFactory.js';
import { pruneEmptyTenants } from './tenantRegistry.js';

const MAX_PER_TENANT = parseInt(process.env.MAX_CALLS_PER_TENANT || '5');

// Get or create a worker for a specific tenant
const tenantWorkers = new Map();
function getTenantWorker(tenantId) {
  if (!tenantWorkers.has(tenantId)) {
    console.log(`[FairDispatcher] Spawning worker for tenant ${tenantId}`);
    const worker = new Worker(`call-queue-${tenantId}`, async (job) => {
      // Track in-flight count for this tenant manually if needed elsewhere, 
      // though Worker concurrency guarantees max limit.
      await redis.incr(`inflight:calls:${tenantId}`);
      await redis.expire(`inflight:calls:${tenantId}`, 3600);
      try {
        return await processJob(job, tenantId);
      } finally {
        await redis.decr(`inflight:calls:${tenantId}`);
      }
    }, { 
      connection: redis,
      concurrency: MAX_PER_TENANT
    });

    worker.on('error', err => {
      console.error(`[Worker error - ${tenantId}]`, err.message);
    });

    tenantWorkers.set(tenantId, worker);
  }
  return tenantWorkers.get(tenantId);
}

// Ensure workers exist for all active tenant queues
export async function startFairDispatcher() {
  console.log(`[FairDispatcher] Starting worker-based dispatch (Max concurrent per tenant: ${MAX_PER_TENANT})`);

  async function tick() {
    try {
      const tenantIds = await redis.smembers('active:telephony:tenants');
      
      for (const tenantId of tenantIds) {
        getTenantWorker(tenantId);
      }

      // Cleanup occasionally
      if (Math.random() < 0.1) {
        await pruneEmptyTenants(redis, tenantWorkers);
      }
    } catch (err) {
      console.error('[FairDispatcher] Tick error:', err.message);
    }

    setTimeout(tick, 5000); // Only needs to check for new tenants every 5 seconds
  }

  tick();
}

async function processJob(job, tenantId) {
  const { callLogId, phone, contactId, campaignId } = job.data;
  console.log(`[Worker] Picked up job ${job.id} for tenant ${tenantId} to call ${phone}`);

  const log = await prisma.callLog.findUnique({ where: { id: callLogId } });
  if (!log || log.status !== 'queued') {
    console.log(`[Worker] Skipping job ${job.id} — DB status is ${log?.status}`);
    return { skipped: true, reason: log?.status };
  }

  await prisma.callLog.update({
    where: { id: callLogId },
    data: { status: 'in-progress' }
  });

  await job.updateProgress(10);
  const result = await processOutboundCall(job.data);

  // Don't overwrite if the call was killed while in-progress
  const currentLog = await prisma.callLog.findUnique({ where: { id: callLogId }, select: { status: true } });
  if (currentLog?.status === 'cancelled') {
    console.log(`[Worker] Job ${job.id} was killed mid-call — keeping cancelled status`);
    return { skipped: true, reason: 'cancelled' };
  }

  await prisma.callLog.update({
    where: { id: callLogId },
    data: {
      status:       result.status,
      recordingUrl: result.recordingUrl,
      durationMs:   result.durationMs
    }
  });

  console.log(`[Worker] Job ${job.id} completed successfully.`);
  return result;
}
