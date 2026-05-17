// telephony-gateway/src/redis.js
import Redis from 'ioredis';

export const redis = new Redis(
  process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`
);

redis.on('connect', () => console.log('[Redis/Gateway] Connected'));
redis.on('error',   (err) => console.error('[Redis/Gateway] Error:', err.message));
