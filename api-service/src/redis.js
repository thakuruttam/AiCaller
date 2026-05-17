// backend/src/redis.js
// Module-level ioredis singleton — shared by VoiceAgent state, and future Phase 3 services.
import Redis from 'ioredis';

export const redis = new Redis(
  process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || 6379}`
);

redis.on('connect', () => console.log('[Redis] Connected'));
redis.on('error',   (err) => console.error('[Redis] Error:', err.message));
