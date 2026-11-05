import { prisma } from '../db.js';

// Every AI model call a product feature makes costs us money, so each one is recorded
// (tokens + estimated cost) and summed on the Usage page.

// USD per 1M tokens, Google's standard paid-tier list prices (as published Oct–Nov 2026; recheck
// ai.google.dev/gemini-api/docs/pricing when changing models). Gemini bills thinking tokens as
// output. A model missing here is still recorded, just without a cost estimate.
const PRICES_USD_PER_M = {
  'gemini-3.8-flash': { input: 0.75, output: 3.75 },
  'gemini-3.5-flash': { input: 1.50, output: 9.00 },
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
  'gemini-2.5-pro': { input: 1.25, output: 10.00 },
};

export const FEATURE_LABELS = {
  campaign_draft: 'Campaign drafting',
  campaign_try_chat: 'Test chats in the campaign builder',
};

export function estimateCostUsd(model, inputTokens, outputTokens) {
  const price = PRICES_USD_PER_M[model];
  if (!price) return null;
  return (inputTokens * price.input + outputTokens * price.output) / 1e6;
}

/** Record one model call. Never throws: losing a usage row must not fail the feature itself. */
export async function recordAiUsage({ tenantId, userId, feature, provider, model, inputTokens = 0, outputTokens = 0, success }) {
  if (!tenantId) return;
  try {
    await prisma.aiUsageEvent.create({
      data: {
        tenantId,
        userId: userId || null,
        feature,
        provider,
        model,
        inputTokens,
        outputTokens,
        costUsd: estimateCostUsd(model, inputTokens, outputTokens),
        success: !!success,
      },
    });
  } catch (err) {
    console.error('[aiUsage] failed to record usage:', err.message);
  }
}

/** Totals per feature (and overall) for the Usage page. `where` scopes it, e.g. { tenantId }. */
export async function computeAiUsageSummary(where = {}) {
  const events = await prisma.aiUsageEvent.findMany({
    where,
    select: { feature: true, inputTokens: true, outputTokens: true, costUsd: true, success: true, createdAt: true },
  });

  const byFeature = {};
  for (const e of events) {
    const f = (byFeature[e.feature] ||= {
      feature: e.feature, label: FEATURE_LABELS[e.feature] || e.feature,
      requests: 0, successful: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, lastUsedAt: null,
    });
    f.requests += 1;
    if (e.success) f.successful += 1;
    f.inputTokens += e.inputTokens;
    f.outputTokens += e.outputTokens;
    f.costUsd += e.costUsd || 0;
    if (!f.lastUsedAt || e.createdAt > f.lastUsedAt) f.lastUsedAt = e.createdAt;
  }

  const features = Object.values(byFeature);
  return {
    features,
    totalRequests: features.reduce((s, f) => s + f.requests, 0),
    totalTokens: features.reduce((s, f) => s + f.inputTokens + f.outputTokens, 0),
    totalCostUsd: features.reduce((s, f) => s + f.costUsd, 0),
  };
}
