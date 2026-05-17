// src/queues/index.js — all queue + FlowProducer definitions
import { Queue, FlowProducer } from 'bullmq';
import { config } from '../config.js';

const connection = config.redis;

export const QUEUES = {
  INGEST:     'report.ingest',
  NORMALIZE:  'report.normalize',
  EXTRACT:    'report.extract',
  EVALUATE:   'report.evaluate',
  COMPLIANCE: 'report.compliance',
  ASSEMBLE:   'report.assemble',
  DLQ:        'report.dlq'
};

// Queue instances (used by BullBoard and admin API)
export const normalizeQueue  = new Queue(QUEUES.NORMALIZE,  { connection });
export const extractQueue    = new Queue(QUEUES.EXTRACT,    { connection });
export const evaluateQueue   = new Queue(QUEUES.EVALUATE,   { connection });
export const complianceQueue = new Queue(QUEUES.COMPLIANCE, { connection });
export const assembleQueue   = new Queue(QUEUES.ASSEMBLE,   { connection });
export const dlqQueue        = new Queue(QUEUES.DLQ,        { connection });

export const allQueues = [
  normalizeQueue, extractQueue,
  evaluateQueue, complianceQueue, assembleQueue, dlqQueue
];

// Dynamically get or create a per-tenant ingest queue
const tenantIngestQueues = new Map();
export function getTenantIngestQueue(tenantId) {
  if (!tenantIngestQueues.has(tenantId)) {
    tenantIngestQueues.set(tenantId, new Queue(`report.ingest-${tenantId}`, { connection }));
  }
  return tenantIngestQueues.get(tenantId);
}

// FlowProducer — launches the full pipeline as a DAG
export const flowProducer = new FlowProducer({ connection });

/**
 * Enqueue the full evaluation pipeline for a completed call.
 * @param {string} callLogId
 * @param {object} payload  — full job data (campaign config, transcript, etc.)
 * @param {number} priority — 1 = fresh call, 10 = reprocess
 */
export async function enqueueEvaluation(callLogId, payload, priority = 1) {
  const jobData = { callLogId, ...payload };
  const jobOpts = {
    priority,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 86400 }, // keep 24h in Redis
    removeOnFail: false                // keep forever for DLQ inspection
  };

  // BullMQ Flow: assemble waits for compliance, which waits for evaluate,
  // which waits for extract, which waits for normalize.
  await flowProducer.add({
    name: 'assemble',
    queueName: QUEUES.ASSEMBLE,
    data: jobData,
    opts: jobOpts,
    children: [{
      name: 'compliance',
      queueName: QUEUES.COMPLIANCE,
      data: jobData,
      opts: jobOpts,
      children: [{
        name: 'evaluate',
        queueName: QUEUES.EVALUATE,
        data: jobData,
        opts: jobOpts,
        children: [{
          name: 'extract',
          queueName: QUEUES.EXTRACT,
          data: jobData,
          opts: jobOpts,
          children: [{
            name: 'normalize',
            queueName: QUEUES.NORMALIZE,
            data: jobData,
            opts: jobOpts
          }]
        }]
      }]
    }]
  });
}
