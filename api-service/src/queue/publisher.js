// backend/src/queue/publisher.js
// Singleton per-tenant call queue publisher (NO WORKER HERE)
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redis = new Redis(
  process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`,
  { maxRetriesPerRequest: null }
);

redis.on('error', (err) => console.error('[Redis/Publisher] Connection error:', err.message));

const tenantCallQueues = new Map();

export function getTenantCallQueue(tenantId) {
  if (!tenantCallQueues.has(tenantId)) {
    tenantCallQueues.set(tenantId, new Queue(`call-queue-${tenantId}`, { connection: redis }));
  }
  return tenantCallQueues.get(tenantId);
}

export async function enqueueCall(tenantId, callData, opts = {}) {
  // Register tenant in the active set so call-worker discovers this queue
  await redis.sadd('active:telephony:tenants', tenantId);

  const queue = getTenantCallQueue(tenantId);
  // opts.jobId lets a scheduled call be safely re-enqueued (e.g. by the
  // reconciliation sweep, or when an edit reschedules it) — BullMQ no-ops
  // if a job with that id already exists rather than creating a duplicate.
  return queue.add('outbound-call', callData, opts);
}

// Cancels a not-yet-fired scheduled/delayed call (used when a campaign is
// paused/killed/rescheduled before its scheduled time arrives). Safe no-op
// if the job doesn't exist or has already started/finished.
export async function removeQueuedCall(tenantId, callLogId) {
  const queue = getTenantCallQueue(tenantId);
  try {
    const job = await queue.getJob(callLogId);
    if (!job) return;
    const state = await job.getState();
    if (state === 'delayed' || state === 'waiting') {
      await job.remove();
    }
  } catch (err) {
    console.error(`[Publisher] removeQueuedCall(${callLogId}) failed:`, err.message);
  }
}
