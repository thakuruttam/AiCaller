# call-evaluation-service

Standalone BullMQ-based call evaluation pipeline. Receives `CALL_COMPLETED` events from the core app and runs a 5-stage evaluation pipeline producing structured `CallReport` records.

## Architecture

```
Core App → [report.ingest queue] → Ingest Worker
                                       ↓
                          BullMQ Flow (DAG):
                          normalize → extract → evaluate → compliance → assemble
                                                     ↓
                                              CallReport saved to DB
```

## Setup

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, REDIS_HOST, GROQ_API_KEY

npm install
npx prisma generate

# Run migration (safe — only adds new tables, never drops core app tables)
npx prisma db execute --file ./prisma/migration.sql --schema ./prisma/schema.prisma
```

## Running

```bash
# Terminal 1 — queue workers (scale this horizontally)
npm run dev:workers

# Terminal 2 — HTTP API + BullMQ Board
npm run dev:api
```

## URLs

| URL | Description |
|---|---|
| `http://localhost:4000/health` | Health check + queue depths |
| `http://localhost:4000/admin/queues?key=YOUR_ADMIN_KEY` | BullMQ Board live UI |
| `http://localhost:4000/debug/job/:callLogId` | Stage status for a call |
| `http://localhost:4000/debug/queue-stats` | All queue depths |
| `http://localhost:4000/debug/dlq` | Dead letter queue entries |
| `http://localhost:4000/reports/call/:callLogId` | Single call report |
| `http://localhost:4000/reports/campaign/:id` | Campaign aggregate |
| `http://localhost:4000/reports/campaign/:id/contacts` | Contact table (filterable) |
| `http://localhost:4000/reports/campaign/:id/export.csv` | CSV download |
| `POST http://localhost:4000/admin/retry/:callLogId` | Reprocess a call |
| `POST http://localhost:4000/admin/dlq/retry-all` | Retry all DLQ entries |

Admin endpoints require `x-admin-key: YOUR_ADMIN_KEY` header.

## Core App Integration

Add this to `backend/src/telephony/twilioStreamHandler.js` in the `saveTranscript()` function, **after** the successful DB write:

```js
import { Queue } from 'bullmq';

const reportIngestQueue = new Queue('report.ingest', {
  connection: { host: process.env.REDIS_HOST, port: parseInt(process.env.REDIS_PORT || '6379') }
});

// After saving transcript:
await reportIngestQueue.add('CALL_COMPLETED', {
  callLogId:        callLogId,
  campaignId:       campaign.id,
  tenantId:         campaign.tenantId,
  contactName:      callLog.contact?.name,
  transcript:       rawTranscript,
  campaignName:     campaign.name,
  dataToCollect:    campaign.dataToCollect ?? [],
  fieldsToExtract:  campaign.rules?.fieldsToExtract  ?? [],
  scoringRules:     campaign.rules?.scoringRules     ?? [],
  successConditions:campaign.rules?.successConditions ?? [],
  reportWebhook:    campaign.callSettings?.reportWebhook ?? null
}, {
  priority: 1,
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 }
});
```

## Worker Concurrency

Tune in `.env` without code changes:

| Variable | Default | When to increase |
|---|---|---|
| `CONCURRENCY_EXTRACT` | `10` | On paid Groq tier (higher rate limits) |
| `CONCURRENCY_NORMALIZE` | `50` | Rarely needed |
| `CONCURRENCY_ASSEMBLE` | `50` | If DB writes become bottleneck |

## Campaign Config Schema (in core app `Campaign.rules`)

```json
{
  "fieldsToExtract": [
    { "field": "experience", "type": "number", "unit": "years" },
    { "field": "skills",     "type": "array" }
  ],
  "scoringRules": [
    { "field": "experience", "condition": "gte", "value": 3, "score": 25, "label": "3+ years exp" },
    { "field": "skills",     "contains": "React",            "score": 15, "label": "React skill" }
  ],
  "successConditions": [
    { "field": "experience", "condition": "gte", "value": 2 }
  ],
  "reportWebhook": "https://your-crm.com/hooks/call-complete"
}
```
