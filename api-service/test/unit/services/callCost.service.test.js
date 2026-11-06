import { describe, it, expect } from 'vitest';
import { callCostInr, geminiLiveTokens, plivoCostInr, SERVICES } from '../../../src/services/callCost.service.js';
import { USD_TO_INR, PLIVO } from '../../../src/config/callCostRates.js';

describe('plivoCostInr', () => {
  it('bills in 30-second pulses at the Plivo rate', () => {
    const perMin = PLIVO.perMinuteUsd * USD_TO_INR;
    expect(plivoCostInr(61_000)).toBeCloseTo(1.5 * perMin, 6); // 61s → 90s
    expect(plivoCostInr(30_000)).toBeCloseTo(0.5 * perMin, 6);
    expect(plivoCostInr(0)).toBe(0);
  });
});

describe('geminiLiveTokens', () => {
  const reports = [
    { prompt: 1000, response: 200, promptByModality: { TEXT: 900, AUDIO: 100 }, responseByModality: { AUDIO: 200 } },
    { prompt: 1500, response: 300, promptByModality: { TEXT: 1200, AUDIO: 300 }, responseByModality: { AUDIO: 300 } },
  ];

  it('per turn: adds up every report', () => {
    expect(geminiLiveTokens(reports, false)).toEqual({ audioIn: 400, textIn: 2100, audioOut: 500, textOut: 0 });
  });

  it('running total: uses only the last report', () => {
    expect(geminiLiveTokens(reports, true)).toEqual({ audioIn: 300, textIn: 1200, audioOut: 300, textOut: 0 });
  });

  it('without a modality split, counts the prompt as text and the response as audio', () => {
    expect(geminiLiveTokens([{ prompt: 800, response: 150, thoughts: 20 }], false))
      .toEqual({ audioIn: 0, textIn: 800, audioOut: 150, textOut: 20 });
  });
});

describe('callCostInr', () => {
  it('prices every service a Gemini Live call used', () => {
    const cost = callCostInr({
      durationMs: 120_000,
      usage: {
        engine: 'gemini_live',
        geminiReports: [{ prompt: 1e6, response: 1e6, promptByModality: { TEXT: 5e5, AUDIO: 5e5 }, responseByModality: { AUDIO: 1e6 } }],
        sarvamSeconds: 60,
        openai: { 'gpt-4.1-mini-2025-04-14': { requests: 2, inputTokens: 1e6, outputTokens: 0 } },
        evaluation: { model: 'gemini-3.6-flash', inputTokens: 1e6, outputTokens: 0 },
      },
    });
    expect(Object.keys(cost)).toEqual(SERVICES.map(s => s.key));
    expect(cost.geminiAudioIn).toBeCloseTo(0.5 * 3 * USD_TO_INR, 6);
    expect(cost.geminiText).toBeCloseTo(0.5 * 0.75 * USD_TO_INR, 6);
    expect(cost.geminiAudioOut).toBeCloseTo(12 * USD_TO_INR, 6);
    expect(cost.sarvam).toBeCloseTo(0.49, 6);
    expect(cost.openai).toBeCloseTo(0.4 * USD_TO_INR, 6);
    expect(cost.evaluation).toBeCloseTo(0.75 * USD_TO_INR, 6);
    expect(cost.plivo).toBeCloseTo(plivoCostInr(120_000), 6);
  });

  it('a call from before usage logging costs only the phone line', () => {
    const cost = callCostInr({ durationMs: 90_000, usage: null });
    expect(cost.plivo).toBeGreaterThan(0);
    expect(Object.entries(cost).filter(([k]) => k !== 'plivo').every(([, v]) => v === 0)).toBe(true);
  });
});
