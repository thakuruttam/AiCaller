// src/workers/dlqWorker.js — consumes dlqQueue and writes to DLQEntry table
import { Worker } from 'bullmq';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { prisma } from '../db.js';
import { QUEUES } from '../queues/index.js';

export function startDLQWorker() {
  const worker = new Worker(QUEUES.DLQ, async (job) => {
    const { stage, callLogId, error, stackTrace, payload, attempts } = job.data;

    logger.info({ callLogId, stage, error }, '[DLQ] Processing failed job');

    await prisma.dLQEntry.create({
      data: {
        callLogId,
        stage,
        error,
        stackTrace,
        payload,
        attempts: attempts || 1
      }
    });

    logger.info({ callLogId }, '[DLQ] Saved to DLQEntry table');
    return { success: true };
  }, {
    connection: config.redis,
    concurrency: 5
  });

  worker.on('failed', (job, err) => {
    logger.error({ callLogId: job?.data?.callLogId, err: err.message }, '[DLQ] Failed to write to DLQEntry DB');
  });

  logger.info('[Worker] DLQ started');
  return worker;
}
