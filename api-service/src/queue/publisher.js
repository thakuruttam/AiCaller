// backend/src/queue/publisher.js
// Singleton per-tenant call queue publisher (NO WORKER HERE)
import { Queue } from 'bullmq';
import Redis from 'ioredis';

const redis = new Redis(
  process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`
);

redis.on('error', (err) => console.error('[Redis/Publisher] Connection error:', err.message));

const tenantCallQueues = new Map();

export function getTenantCallQueue(tenantId) {
  if (!tenantCallQueues.has(tenantId)) {
    tenantCallQueues.set(tenantId, new Queue(`call-queue-${tenantId}`, { connection: redis }));
  }
  return tenantCallQueues.get(tenantId);
}

export async function enqueueCall(tenantId, callData) {
  // Register tenant in the active set so call-worker discovers this queue
  await redis.sadd('active:telephony:tenants', tenantId);
  
  const queue = getTenantCallQueue(tenantId);
  return queue.add('outbound-call', callData);
}
