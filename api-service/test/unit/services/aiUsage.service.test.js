import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/db.js', () => ({ prisma: { aiUsageEvent: { create: vi.fn(), findMany: vi.fn() } } }));

import { prisma } from '../../../src/db.js';
import { estimateCostUsd, recordAiUsage, computeAiUsageSummary } from '../../../src/services/aiUsage.service.js';

describe('estimateCostUsd', () => {
  it('prices tokens at the model list price, output dearer than input', () => {
    expect(estimateCostUsd('gemini-2.5-flash', 1_000_000, 0)).toBeCloseTo(0.30);
    expect(estimateCostUsd('gemini-2.5-flash', 0, 1_000_000)).toBeCloseTo(2.50);
    expect(estimateCostUsd('gemini-2.5-flash', 1200, 1200)).toBeCloseTo(0.00336);
  });

  it('knows the current drafting models', () => {
    expect(estimateCostUsd('gemini-3.8-flash', 1_000_000, 1_000_000)).toBeCloseTo(4.50);
    expect(estimateCostUsd('gemini-3.5-flash', 490, 2230)).toBeCloseTo(0.020805);
  });

  it('returns null for a model with no known price', () => {
    expect(estimateCostUsd('claude-opus-5-5', 1000, 1000)).toBeNull();
  });
});

describe('recordAiUsage', () => {
  beforeEach(() => { prisma.aiUsageEvent.create.mockReset(); });

  it('stores the call with its estimated cost', async () => {
    await recordAiUsage({ tenantId: 't1', userId: 'u1', feature: 'campaign_draft', provider: 'gemini', model: 'gemini-2.5-flash', inputTokens: 1200, outputTokens: 1200, success: true });
    const { data } = prisma.aiUsageEvent.create.mock.calls[0][0];
    expect(data).toMatchObject({ tenantId: 't1', userId: 'u1', feature: 'campaign_draft', success: true, inputTokens: 1200, outputTokens: 1200 });
    expect(data.costUsd).toBeCloseTo(0.00336);
  });

  it('never throws when the database write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    prisma.aiUsageEvent.create.mockRejectedValue(new Error('db down'));
    await expect(recordAiUsage({ tenantId: 't1', feature: 'campaign_draft', provider: 'gemini', model: 'gemini-2.5-flash', success: true })).resolves.toBeUndefined();
  });
});

describe('computeAiUsageSummary', () => {
  it('sums requests, tokens and cost per feature and overall', async () => {
    prisma.aiUsageEvent.findMany.mockResolvedValue([
      { feature: 'campaign_draft', inputTokens: 1000, outputTokens: 2000, costUsd: 0.0053, success: true, createdAt: new Date('2026-11-04T10:00:00Z') },
      { feature: 'campaign_draft', inputTokens: 500, outputTokens: 100, costUsd: 0.0004, success: false, createdAt: new Date('2026-11-05T09:00:00Z') },
    ]);
    const summary = await computeAiUsageSummary({ tenantId: 't1' });
    expect(prisma.aiUsageEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't1' } }));
    expect(summary.totalRequests).toBe(2);
    expect(summary.totalTokens).toBe(3600);
    expect(summary.totalCostUsd).toBeCloseTo(0.0057);
    expect(summary.features[0]).toMatchObject({ feature: 'campaign_draft', label: 'Campaign drafting', requests: 2, successful: 1 });
    expect(summary.features[0].lastUsedAt.toISOString()).toBe('2026-11-05T09:00:00.000Z');
  });
});
