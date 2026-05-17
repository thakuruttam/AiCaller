// src/workers/evaluateWorker.js  (Stage 3 — rule engine)
import { Worker }      from 'bullmq';
import { config }      from '../config.js';
import { logger }      from '../logger.js';
import { prisma }      from '../db.js';
import { QUEUES, dlqQueue } from '../queues/index.js';
import { evaluate }    from '../pipeline/ruleEngine.js';

export function startEvaluateWorker() {
  const worker = new Worker(QUEUES.EVALUATE, async (job) => {
    const { callLogId, scoringRules = [] } = job.data;
    const childValues = await job.getChildrenValues();
    const flowState = Object.values(childValues)[0] || {};
    const extracted = flowState.extracted;
    const STAGE = 'evaluateStatus';

    const existing = await prisma.reportJob.findUnique({ where: { callLogId } });
    if (existing?.[STAGE] === 'done') {
      logger.info({ callLogId }, '[Evaluate] Idempotent skip');
      return;
    }

    await prisma.reportJob.update({ where: { callLogId }, data: { [STAGE]: 'running' } });

    const result = evaluate(extracted?.extractedFields ?? {}, scoringRules);
    flowState.evaluated = result;

    await prisma.reportJob.update({
      where: { callLogId },
      data: { [STAGE]: 'done', totalAttempts: { increment: 1 } }
    });

    logger.info({ callLogId, score: result.score }, '[Evaluate] Done');
    return flowState;

  }, {
    connection: config.redis,
    concurrency: config.concurrency.evaluate
  });

  attachDLQHandler(worker, 'evaluate', dlqQueue);
  logger.info({ concurrency: config.concurrency.evaluate }, '[Worker] Evaluate started');
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
