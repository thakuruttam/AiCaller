// src/workers/normalizeWorker.js
import { Worker }      from 'bullmq';
import { config }      from '../config.js';
import { logger }      from '../logger.js';
import { prisma }      from '../db.js';
import { QUEUES, dlqQueue } from '../queues/index.js';
import { normalize }   from '../pipeline/normalizer.js';

export function startNormalizeWorker() {
  const worker = new Worker(QUEUES.NORMALIZE, async (job) => {
    const { callLogId, transcript } = job.data;
    const STAGE = 'normalizeStatus';

    // Idempotency check
    const existing = await prisma.reportJob.findUnique({ where: { callLogId } });
    if (existing?.[STAGE] === 'done') {
      logger.info({ callLogId }, '[Normalize] Idempotent skip');
      return;
    }

    await prisma.reportJob.update({ where: { callLogId }, data: { [STAGE]: 'running' } });

    const start = Date.now();
    const result = normalize(transcript);

    // We return the result so the parent job in the flow can access it
    const flowState = { normalised: result };

    await prisma.reportJob.update({
      where: { callLogId },
      data: { [STAGE]: 'done', totalAttempts: { increment: 1 } }
    });

    logger.info({ callLogId, turns: result.turns.length, durationMs: Date.now() - start }, '[Normalize] Done');
    return flowState;

  }, {
    connection: config.redis,
    concurrency: config.concurrency.normalize
  });

  attachDLQHandler(worker, 'normalize', dlqQueue);
  logger.info({ concurrency: config.concurrency.normalize }, '[Worker] Normalize started');
  return worker;
}

function attachDLQHandler(worker, stage, dlqQueue) {
  worker.on('failed', async (job, err) => {
    await prisma.reportJob.update({
      where: { callLogId: job?.data?.callLogId },
      data: { [`${stage}Status`]: 'failed', lastError: err.message }
    }).catch(() => {});

    if (job && job.attemptsMade >= (job.opts?.attempts ?? 3)) {
      await dlqQueue.add('failed', {
        stage, callLogId: job.data.callLogId,
        error: err.message, stackTrace: err.stack, payload: job.data, attempts: job.attemptsMade
      });
    }
  });
}
