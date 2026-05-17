// call-worker/src/index.js
import 'dotenv/config';
import { startFairDispatcher } from './fairDispatcher.js';

console.log('[CallWorker] Starting outbound telephony worker...');
startFairDispatcher();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[CallWorker] Shutting down...');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('[CallWorker] Shutting down...');
  process.exit(0);
});
