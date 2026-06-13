import Redis from 'ioredis';

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null
};

export const config = {
  database: {
    url: process.env.DATABASE_URL
  },
  redis: process.env.REDIS_URL 
    ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
    : new Redis(redisConfig),
  redisConfig, // export raw config for BullMQ if needed
  groq: {
    apiKey: process.env.GROQ_API_KEY,
    model:  process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model:  process.env.OPENAI_MODEL || 'gpt-4.1-mini'
  },
  concurrency: {
    normalize:  parseInt(process.env.CONCURRENCY_NORMALIZE  || '50'),
    extract:    parseInt(process.env.CONCURRENCY_EXTRACT    || '10'),
    evaluate:   parseInt(process.env.CONCURRENCY_EVALUATE   || '100'),
    compliance: parseInt(process.env.CONCURRENCY_COMPLIANCE || '100'),
    assemble:   parseInt(process.env.CONCURRENCY_ASSEMBLE   || '50')
  },
  port:        parseInt(process.env.EVAL_PORT || '4000'),
  logLevel:    process.env.LOG_LEVEL || 'info',
  adminApiKey: process.env.ADMIN_API_KEY || 'change-me-in-production'
};
