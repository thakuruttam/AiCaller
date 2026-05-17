// src/consumer.js — entry point: starts all BullMQ workers
import 'dotenv/config';
import { logger } from './logger.js';
import { startIngestWorker }     from './workers/ingestWorker.js';
import { startNormalizeWorker }  from './workers/normalizeWorker.js';
import { startExtractWorker }    from './workers/extractWorker.js';
import { startEvaluateWorker }   from './workers/evaluateWorker.js';
import { startComplianceWorker } from './workers/complianceWorker.js';
import { startAssembleWorker }   from './workers/assembleWorker.js';
import { startDLQWorker }        from './workers/dlqWorker.js';

logger.info('[Service] Starting call-evaluation-service workers...');

const workers = [
  startIngestWorker(),
  startNormalizeWorker(),
  startExtractWorker(),
  startEvaluateWorker(),
  startComplianceWorker(),
  startAssembleWorker(),
  startDLQWorker()
];

// Graceful shutdown
async function shutdown() {
  logger.info('[Service] Shutting down workers...');
  await Promise.all(workers.map(w => w.close()));
  logger.info('[Service] All workers stopped. Exiting.');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

logger.info('[Service] All workers running. Waiting for jobs...');
