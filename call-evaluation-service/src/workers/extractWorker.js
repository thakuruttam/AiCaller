// src/workers/extractWorker.js  (Stage 2 — LLM, throttled)
import { Worker }      from 'bullmq';
import { config }      from '../config.js';
import { logger }      from '../logger.js';
import { prisma }      from '../db.js';
import { QUEUES, dlqQueue } from '../queues/index.js';
import { extract }     from '../pipeline/extractor.js';

export function startExtractWorker() {
  const worker = new Worker(QUEUES.EXTRACT, async (job) => {
    const { callLogId, dataToCollect = [] } = job.data;
    const childValues = await job.getChildrenValues();
    const flowState = Object.values(childValues)[0] || {};
    const normalised = flowState.normalised;
    const STAGE = 'extractStatus';

    const existing = await prisma.reportJob.findUnique({ where: { callLogId } });
    if (existing?.[STAGE] === 'done') {
      logger.info({ callLogId }, '[Extract] Idempotent skip');
      return;
    }

    await prisma.reportJob.update({ where: { callLogId }, data: { [STAGE]: 'running' } });

    const result = await extract(normalised?.turns ?? [], dataToCollect);
    flowState.extracted = result;

    // Record the scoring model's tokens next to the live call's own usage, for
    // the cost breakdown on the Usage page. Never fails the pipeline.
    if (result.usage) {
      try {
        const log = await prisma.callLog.findUnique({ where: { id: callLogId }, select: { usage: true } });
        await prisma.callLog.update({
          where: { id: callLogId },
          data: { usage: { ...(log?.usage || {}), evaluation: result.usage } },
        });
      } catch (err) {
        logger.warn({ callLogId, err: err.message }, '[Extract] Could not record evaluation usage');
      }
    }

    await prisma.reportJob.update({
      where: { callLogId },
      data: { [STAGE]: 'done', totalAttempts: { increment: 1 } }
    });

    logger.info({
      callLogId,
      questionResults: result.questionResults?.length ?? 0,
      fieldsExtracted: Object.keys(result.extractedFields).filter(k => result.extractedFields[k]?.value != null),
      missing: result.missingFields
    }, '[Extract] Done');
    return flowState;

  }, {
    connection: config.redis,
    concurrency: config.concurrency.extract   // throttled — LLM bottleneck
  });

  attachDLQHandler(worker, 'extract', dlqQueue);
  logger.info({ concurrency: config.concurrency.extract }, '[Worker] Extract started');
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
