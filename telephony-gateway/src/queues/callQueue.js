// telephony-gateway/src/queues/callQueue.js
// Per-tenant outbound-call queue publisher for automatic call retries.
// Mirrors api-service/src/queue/publisher.js — same queue name convention
// (call-queue-{tenantId}) so call-worker's fairDispatcher, which already
// listens there, picks these jobs up with no changes on its side.
import { Queue } from 'bullmq';
import { redis } from '../redis.js';

const tenantCallQueues = new Map();

function getTenantCallQueue(tenantId) {
  if (!tenantCallQueues.has(tenantId)) {
    tenantCallQueues.set(tenantId, new Queue(`call-queue-${tenantId}`, { connection: redis }));
  }
  return tenantCallQueues.get(tenantId);
}

export async function enqueueCall(tenantId, callData, opts = {}) {
  await redis.sadd('active:telephony:tenants', tenantId);
  const queue = getTenantCallQueue(tenantId);
  return queue.add('outbound-call', callData, opts);
}
