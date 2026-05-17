// backend/src/queue/singletons.js
// Singleton BullMQ Queue instances — import these everywhere instead of creating new Queue() inline.
// Creating a new Queue() per request/call leaks Redis connections under load.

import { Queue } from 'bullmq';
import Redis from 'ioredis';

// Shared Redis connection for all singleton queues
const connection = new Redis(
  process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`,
  { maxRetriesPerRequest: null }
);

connection.on('error', (err) => {
  console.error('[Redis/Singletons] Connection error:', err.message);
});

// ── Outbound call queue (consumed by call-worker) ──────────────────────────
// One global queue for now; Phase 3 migrates this to per-tenant queues.
export const callQueue = new Queue('call-queue', { connection });

// ── Evaluation ingest queue (consumed by call-evaluation-service) ──────────
const tenantIngestQueues = new Map();

export function getTenantIngestQueue(tenantId) {
  if (!tenantIngestQueues.has(tenantId)) {
    tenantIngestQueues.set(tenantId, new Queue(`report.ingest-${tenantId}`, { connection }));
  }
  return tenantIngestQueues.get(tenantId);
}

/**
 * Publish a CALL_COMPLETED event to the evaluation pipeline.
 * Centralised here so all callers use the same singleton and options.
 */
export async function publishEvaluation(payload, priority = 1) {
  // Register tenant in the active set so the evaluation dispatcher discovers this queue
  await connection.sadd('active:evaluation:tenants', payload.tenantId);
  
  const queue = getTenantIngestQueue(payload.tenantId);
  return queue.add('CALL_COMPLETED', payload, {
    priority,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400 },
    removeOnFail: false
  });
}
