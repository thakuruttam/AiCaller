// src/workers/assembleWorker.js  (Stage 5 — final DB write)
import { Worker }           from 'bullmq';
import { config }           from '../config.js';
import { logger }           from '../logger.js';
import { prisma }           from '../db.js';
import { QUEUES, dlqQueue } from '../queues/index.js';
import { assemble }         from '../pipeline/assembler.js';

export function startAssembleWorker() {
  const worker = new Worker(QUEUES.ASSEMBLE, async (job) => {
    const { callLogId } = job.data;
    const STAGE = 'assembleStatus';

    const existing = await prisma.reportJob.findUnique({ where: { callLogId } });
    if (existing?.[STAGE] === 'done') {
      logger.info({ callLogId }, '[Assemble] Idempotent skip');
      return;
    }

    await prisma.reportJob.update({
      where: { callLogId },
      data: { [STAGE]: 'running', startedAt: existing?.startedAt ?? new Date() }
    });

    const childValues = await job.getChildrenValues();
    const flowState = Object.values(childValues)[0] || {};
    const stageOutputs = {
      normalised:  flowState.normalised,
      extracted:   flowState.extracted,
      evaluated:   flowState.evaluated,
      compliance:  flowState.compliance
    };

    const reportData = await assemble(job.data, stageOutputs);

    await prisma.reportJob.update({
      where: { callLogId },
      data: { [STAGE]: 'done', completedAt: new Date(), totalAttempts: { increment: 1 } }
    });

    logger.info({ callLogId, outcome: reportData.outcome }, '[Assemble] Pipeline complete');
    return reportData;

  }, {
    connection: config.redis,
    concurrency: config.concurrency.assemble
  });

  attachDLQHandler(worker, 'assemble', dlqQueue);
  logger.info({ concurrency: config.concurrency.assemble }, '[Worker] Assemble started');
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
