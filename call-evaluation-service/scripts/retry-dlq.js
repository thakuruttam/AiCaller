import 'dotenv/config';
import { Queue } from 'bullmq';
import { config } from '../src/config.js';

async function main() {
  const dlqQueue = new Queue('report.dlq', { connection: config.redis });
  const ingestQueue = new Queue('report.ingest', { connection: config.redis });

  console.log("Fetching failed jobs from DLQ...");
  const jobs = await dlqQueue.getJobs(['delayed', 'waiting', 'active', 'completed', 'failed']);
  
  if (jobs.length === 0) {
    console.log("No jobs found in DLQ.");
    process.exit(0);
  }

  console.log(`Found ${jobs.length} failed jobs. Due to strict LLM free-tier rate limits (6000 TPM), we will re-queue these slowly (1 job every 6 seconds) to avoid hitting the rate limit again.`);

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    // The DLQ payload stores the original job data inside job.data.payload
    const payload = job.data.payload;
    
    if (payload) {
      await ingestQueue.add('CALL_COMPLETED', payload);
      console.log(`Re-queued job ${i + 1}/${jobs.length} (Call: ${payload.callLogId})`);
    }
    
    // Delete from DLQ
    await job.remove();

    // Sleep for 6 seconds to respect rate limits
    if (i < jobs.length - 1) {
      await new Promise(r => setTimeout(r, 6000));
    }
  }

  console.log("All failed jobs have been slowly re-queued to the evaluation pipeline!");
  process.exit(0);
}

main().catch(console.error);
