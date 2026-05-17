// call-worker/src/redis.js
import Redis from 'ioredis';

export const redis = new Redis(
  process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`,
  { maxRetriesPerRequest: null }
);

redis.on('connect', () => console.log('[Redis/CallWorker] Connected'));
redis.on('error',   (err) => console.error('[Redis/CallWorker] Error:', err.message));
