// telephony-gateway/src/queues/ingestQueue.js
// Per-tenant evaluation queue publisher.
// Publishes to report.ingest:{tenantId} so each tenant gets isolated queue processing.
import { Queue } from 'bullmq';
import { redis } from '../redis.js';

// Singleton map: tenantId → Queue instance
const tenantQueues = new Map();

function getTenantIngestQueue(tenantId) {
  if (!tenantQueues.has(tenantId)) {
    tenantQueues.set(tenantId, new Queue(`report.ingest-${tenantId}`, {
      connection: redis,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 100 }
    }));
  }
  return tenantQueues.get(tenantId);
}

/**
 * Publish a CALL_COMPLETED event for a specific tenant.
 * Registers the tenant in the active-eval-tenants set so ingestWorker discovers it.
 */
export async function publishEvaluation(tenantId, payload, priority = 1) {
  // Register this tenant so the eval service worker discovers the queue
  await redis.sadd('active:eval:tenants', tenantId);

  const queue = getTenantIngestQueue(tenantId);
  return queue.add('CALL_COMPLETED', payload, {
    priority,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: false
  });
}
