// src/workers/complianceWorker.js  (Stage 4)
import { Worker }           from 'bullmq';
import { config }           from '../config.js';
import { logger }           from '../logger.js';
import { prisma }           from '../db.js';
import { QUEUES, dlqQueue } from '../queues/index.js';
import { checkCompliance }  from '../pipeline/complianceChecker.js';

export function startComplianceWorker() {
  const worker = new Worker(QUEUES.COMPLIANCE, async (job) => {
    const { callLogId, dataToCollect = [] } = job.data;
    const childValues = await job.getChildrenValues();
    const flowState = Object.values(childValues)[0] || {};
    const normalised = flowState.normalised;
    const STAGE = 'complianceStatus';

    const existing = await prisma.reportJob.findUnique({ where: { callLogId } });
    if (existing?.[STAGE] === 'done') {
      logger.info({ callLogId }, '[Compliance] Idempotent skip');
      return;
    }

    await prisma.reportJob.update({ where: { callLogId }, data: { [STAGE]: 'running' } });

    const result = checkCompliance(normalised?.turns ?? [], dataToCollect);
    flowState.compliance = result;

    await prisma.reportJob.update({
      where: { callLogId },
      data: { [STAGE]: 'done', totalAttempts: { increment: 1 } }
    });

    logger.info({ callLogId, matched: Object.values(result).filter(v => v).length }, '[Compliance] Done');
    return flowState;

  }, {
    connection: config.redis,
    concurrency: config.concurrency.compliance
  });

  attachDLQHandler(worker, 'compliance', dlqQueue);
  logger.info({ concurrency: config.concurrency.compliance }, '[Worker] Compliance started');
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
