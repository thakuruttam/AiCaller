-- call-evaluation-service: table creation migration
-- Run this ONCE against the existing database.
-- This does NOT touch any core app tables (CallLog, Campaign, etc.)

CREATE TABLE IF NOT EXISTS "CallReport" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "callLogId"      TEXT NOT NULL,
  "campaignId"     TEXT,
  "tenantId"       TEXT,
  "contactName"    TEXT,
  "outcome"        TEXT,
  "failureReason"  TEXT,
  "sentiment"      TEXT,
  "score"          INTEGER,
  "reportSummary"  TEXT,
  "completionRate" DOUBLE PRECISION,
  "extractedFields" JSONB,
  "missingFields"   JSONB,
  "complianceData"  JSONB,
  "scoreBreakdown"  JSONB,
  "reportData"      JSONB,
  "schemaVersion"  TEXT NOT NULL DEFAULT '1.0',
  "modelVersion"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CallReport_callLogId_key" UNIQUE ("callLogId")
);

CREATE TABLE IF NOT EXISTS "ReportJob" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "callLogId"        TEXT NOT NULL,
  "ingestStatus"     TEXT NOT NULL DEFAULT 'pending',
  "normalizeStatus"  TEXT NOT NULL DEFAULT 'pending',
  "extractStatus"    TEXT NOT NULL DEFAULT 'pending',
  "evaluateStatus"   TEXT NOT NULL DEFAULT 'pending',
  "complianceStatus" TEXT NOT NULL DEFAULT 'pending',
  "assembleStatus"   TEXT NOT NULL DEFAULT 'pending',
  "totalAttempts"    INTEGER NOT NULL DEFAULT 0,
  "lastError"        TEXT,
  "priority"         INTEGER NOT NULL DEFAULT 1,
  "startedAt"        TIMESTAMP(3),
  "completedAt"      TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReportJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReportJob_callLogId_key" UNIQUE ("callLogId"),
  CONSTRAINT "ReportJob_callLogId_fkey"
    FOREIGN KEY ("callLogId") REFERENCES "CallReport"("callLogId")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "DLQEntry" (
  "id"         TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "callLogId"  TEXT NOT NULL,
  "stage"      TEXT NOT NULL,
  "payload"    JSONB NOT NULL,
  "error"      TEXT NOT NULL,
  "stackTrace" TEXT,
  "attempts"   INTEGER NOT NULL,
  "canRetry"   BOOLEAN NOT NULL DEFAULT true,
  "retried"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DLQEntry_pkey" PRIMARY KEY ("id")
);

-- Composite indexes for fast campaign-level queries
CREATE INDEX IF NOT EXISTS "CallReport_campaignId_outcome_idx"   ON "CallReport"("campaignId", "outcome");
CREATE INDEX IF NOT EXISTS "CallReport_campaignId_score_idx"     ON "CallReport"("campaignId", "score");
CREATE INDEX IF NOT EXISTS "CallReport_campaignId_sentiment_idx" ON "CallReport"("campaignId", "sentiment");
CREATE INDEX IF NOT EXISTS "CallReport_campaignId_createdAt_idx" ON "CallReport"("campaignId", "createdAt");
CREATE INDEX IF NOT EXISTS "CallReport_tenantId_createdAt_idx"   ON "CallReport"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReportJob_extractStatus_idx"         ON "ReportJob"("extractStatus");
CREATE INDEX IF NOT EXISTS "ReportJob_assembleStatus_idx"        ON "ReportJob"("assembleStatus");
CREATE INDEX IF NOT EXISTS "DLQEntry_callLogId_idx"              ON "DLQEntry"("callLogId");
CREATE INDEX IF NOT EXISTS "DLQEntry_stage_idx"                  ON "DLQEntry"("stage");
CREATE INDEX IF NOT EXISTS "DLQEntry_retried_idx"                ON "DLQEntry"("retried");

-- Auto-update updatedAt trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW."updatedAt" = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_call_report_updated_at ON "CallReport";
CREATE TRIGGER update_call_report_updated_at
  BEFORE UPDATE ON "CallReport"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_report_job_updated_at ON "ReportJob";
CREATE TRIGGER update_report_job_updated_at
  BEFORE UPDATE ON "ReportJob"
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
