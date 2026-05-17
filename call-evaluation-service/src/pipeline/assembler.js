// src/pipeline/assembler.js — Stage 5: merge all outputs + LLM summary + DB write
import { config } from '../config.js';
import { logger }  from '../logger.js';
import { prisma }  from '../db.js';

const FAILURE_MAP = [
  { pattern: /I apologize for the confusion/i, reason: 'wrong_person',       outcome: 'WRONG_PERSON'  },
  { pattern: /call back later|call me back|busy|reschedule/i, reason: 'callback_requested', outcome: 'RESCHEDULE' },
  { pattern: /no answer|not available/i,        reason: 'no_answer',          outcome: 'NO_ANSWER'     },
  { pattern: /call.*disconnected/i,             reason: 'disconnected',        outcome: 'INCOMPLETE'    },
  { pattern: /I don't want to|not interested/i, reason: 'refused',            outcome: 'INCOMPLETE'    },
];

/**
 * Final assembly: merges all pipeline stage outputs, generates a summary, writes to DB.
 */
export async function assemble(jobData, stageOutputs) {
  const {
    callLogId, campaignId, tenantId, contactName,
    campaignName, fieldsToExtract = [], reportWebhook
  } = jobData;

  const { normalised, extracted, evaluated, compliance } = stageOutputs;

  // ── Outcome + failure classification (deterministic) ──────────────
  let outcome      = 'COMPLETED';
  let failureReason = null;

  const allAgentText = (normalised?.turns ?? [])
    .filter(t => t.role === 'agent')
    .map(t => t.text)
    .join(' ');

  for (const entry of FAILURE_MAP) {
    if (entry.pattern.test(allAgentText)) {
      outcome      = entry.outcome;
      failureReason = entry.reason;
      break;
    }
  }

  if ((normalised?.turns ?? []).length < 3) {
    outcome = 'NO_ANSWER';
    failureReason = 'no_answer';
  }

  // ── Completion rate ────────────────────────────────────────────────
  const expectedCount  = fieldsToExtract.length;
  const extractedCount = expectedCount > 0
    ? Object.values(extracted?.extractedFields ?? {}).filter(f => f?.value != null).length
    : 0;
  const completionRate = expectedCount > 0 ? extractedCount / expectedCount : null;

  // ── Summary + sentiment (now from Stage 2) ────────────────────────
  const reportSummary = extracted?.summary   || null;
  const sentiment     = extracted?.sentiment || 'neutral';

  // ── Assemble full reportData ──────────────────────────────────────
  const reportData = {
    schemaVersion:  '1.0',
    modelVersion:   extracted?.modelVersion ?? config.groq.model,
    generatedAt:    new Date().toISOString(),
    callLogId,
    campaignName,
    contactName,
    outcome,
    failureReason,
    sentiment,
    score:          evaluated?.score    ?? null,
    scoreBreakdown: evaluated?.breakdown ?? [],
    completionRate,
    reportSummary,
    extractedFields: extracted?.extractedFields ?? {},
    missingFields:   extracted?.missingFields   ?? [],
    complianceData:  compliance ?? {}
  };

  // ── Write to DB ───────────────────────────────────────────────────
  await prisma.callReport.upsert({
    where: { callLogId },
    create: {
      callLogId, campaignId, tenantId, contactName,
      outcome, failureReason, sentiment,
      score:          evaluated?.score    ?? null,
      completionRate: completionRate,
      reportSummary,
      extractedFields: extracted?.extractedFields ?? {},
      missingFields:   extracted?.missingFields   ?? [],
      complianceData:  compliance ?? {},
      scoreBreakdown:  evaluated?.breakdown ?? [],
      reportData,
      schemaVersion:   '1.0',
      modelVersion:    extracted?.modelVersion ?? config.groq.model
    },
    update: {
      outcome, failureReason, sentiment,
      score:          evaluated?.score    ?? null,
      completionRate,
      reportSummary,
      extractedFields: extracted?.extractedFields ?? {},
      missingFields:   extracted?.missingFields   ?? [],
      complianceData:  compliance ?? {},
      scoreBreakdown:  evaluated?.breakdown ?? [],
      reportData,
      schemaVersion:   '1.0',
      modelVersion:    extracted?.modelVersion ?? config.groq.model,
      updatedAt:       new Date()
    }
  });

  // ── Optional webhook ──────────────────────────────────────────────
  if (reportWebhook) {
    fetch(reportWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData)
    }).catch(e => logger.warn({ callLogId, err: e.message }, '[Assembler] Webhook failed'));
  }

  logger.info({ callLogId, outcome, score: evaluated?.score, sentiment }, '[Assembler] Report saved');
  return reportData;
}
