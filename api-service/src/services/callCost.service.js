import { prisma } from '../db.js';
import {
  FIXED_MONTHLY_INR, GEMINI_LIVE, GEMINI_LIVE_USAGE_IS_CUMULATIVE, PLIVO, SARVAM_PER_MINUTE_INR,
  TEXT_MODELS, USD_TO_INR,
} from '../config/callCostRates.js';

// Prices what each call actually used (CallLog.usage, recorded by
// telephony-gateway and call-evaluation-service) into a per-service
// breakdown, for question calls vs conversation calls. Super-admin only:
// these are our costs, not the customer's.

export const SERVICES = [
  { key: 'plivo', label: 'Phone line (Plivo)' },
  { key: 'geminiAudioIn', label: 'Gemini Live — caller audio in' },
  { key: 'geminiAudioOut', label: 'Gemini Live — bot audio out' },
  { key: 'geminiText', label: 'Gemini Live — instructions, history & text' },
  { key: 'sarvam', label: 'Sarvam speech-to-text' },
  { key: 'openai', label: 'OpenAI checks during the call' },
  { key: 'evaluation', label: 'Scoring after the call (Gemini)' },
];

const perM = (tokens, usdPerM) => (tokens / 1e6) * usdPerM * USD_TO_INR;
const textRate = (model) => TEXT_MODELS.find(m => String(model || '').startsWith(m.prefix));

/** Plivo charge for a call of this length, in ₹ (30-second pulses). */
export function plivoCostInr(durationMs) {
  if (!durationMs) return 0;
  const pulses = Math.ceil(durationMs / 1000 / PLIVO.pulseSeconds);
  return (pulses * PLIVO.pulseSeconds / 60) * PLIVO.perMinuteUsd * USD_TO_INR;
}

/**
 * Gemini Live tokens for one call, by kind. The reports are priced one by one
 * (per turn) unless GEMINI_LIVE_USAGE_IS_CUMULATIVE, when only the last one is.
 * A report without a modality split counts its prompt as text and its
 * response as audio — the session only ever answers in audio.
 */
export function geminiLiveTokens(reports = [], cumulative = GEMINI_LIVE_USAGE_IS_CUMULATIVE) {
  const used = cumulative ? reports.slice(-1) : reports;
  const t = { audioIn: 0, textIn: 0, audioOut: 0, textOut: 0 };
  for (const r of used) {
    const pAudio = r.promptByModality?.AUDIO || 0;
    const pText = (r.promptByModality?.TEXT || 0) || Math.max(0, (r.prompt || 0) - pAudio);
    const rText = r.responseByModality?.TEXT || 0;
    const rAudio = (r.responseByModality?.AUDIO || 0) || Math.max(0, (r.response || 0) - rText);
    t.audioIn += pAudio; t.textIn += pText; t.audioOut += rAudio; t.textOut += rText + (r.thoughts || 0);
  }
  return t;
}

/** One call's cost by service, in ₹. */
export function callCostInr(log) {
  const u = log.usage || {};
  const cost = Object.fromEntries(SERVICES.map(s => [s.key, 0]));
  cost.plivo = plivoCostInr(log.durationMs);
  if (u.engine === 'gemini_live') {
    const rate = GEMINI_LIVE.default;
    const t = geminiLiveTokens(u.geminiReports);
    cost.geminiAudioIn = perM(t.audioIn, rate.audioInPerM);
    cost.geminiAudioOut = perM(t.audioOut, rate.audioOutPerM);
    cost.geminiText = perM(t.textIn, rate.textInPerM) + perM(t.textOut, rate.textOutPerM);
  }
  cost.sarvam = ((u.sarvamSeconds || 0) / 60) * SARVAM_PER_MINUTE_INR;
  for (const [model, m] of Object.entries(u.openai || {})) {
    const r = textRate(model);
    if (r) cost.openai += perM(m.inputTokens || 0, r.inPerM) + perM(m.outputTokens || 0, r.outPerM);
  }
  if (u.evaluation) {
    const r = textRate(u.evaluation.model);
    if (r) cost.evaluation = perM(u.evaluation.inputTokens || 0, r.inPerM) + perM(u.evaluation.outputTokens || 0, r.outPerM);
  }
  return cost;
}

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Cost breakdown for answered calls in the last `days`, split by campaign
 * mode. Calls placed before usage logging existed are counted separately
 * and contribute only the phone line.
 */
export async function computeCallCosts(where = {}, { days = 30, now = Date.now() } = {}) {
  const since = new Date(now - days * 864e5);
  const logs = await prisma.callLog.findMany({
    where: { ...where, createdAt: { gte: since }, durationMs: { gt: 0 } },
    select: { durationMs: true, usage: true, campaign: { select: { mode: true } } },
  });

  const groups = {};
  for (const log of logs) {
    const mode = log.usage?.mode || (log.campaign?.mode === 'conversation' ? 'conversation' : 'questions');
    const g = groups[mode] ||= { calls: 0, metered: 0, minutes: 0, cost: Object.fromEntries(SERVICES.map(s => [s.key, 0])) };
    g.calls += 1;
    g.minutes += log.durationMs / 60000;
    if (log.usage?.engine) g.metered += 1;
    const c = callCostInr(log);
    for (const k of Object.keys(c)) g.cost[k] += c[k];
  }

  const out = {};
  let allMinutes = 0;
  for (const [mode, g] of Object.entries(groups)) {
    const total = Object.values(g.cost).reduce((s, v) => s + v, 0);
    allMinutes += g.minutes;
    out[mode] = {
      calls: g.calls,
      meteredCalls: g.metered,
      minutes: round(g.minutes),
      totalInr: round(total),
      perMinuteInr: g.minutes ? round(total / g.minutes) : 0,
      perCallInr: g.calls ? round(total / g.calls) : 0,
      services: SERVICES.map(s => ({
        key: s.key,
        label: s.label,
        totalInr: round(g.cost[s.key]),
        perMinuteInr: g.minutes ? round(g.cost[s.key] / g.minutes, 3) : 0,
      })),
    };
  }

  const knownFixed = FIXED_MONTHLY_INR.filter(f => f.inr != null).reduce((s, f) => s + f.inr, 0);
  const fixedForPeriod = knownFixed * (days / 30);
  return {
    days,
    usdToInr: USD_TO_INR,
    geminiUsageCountedAs: GEMINI_LIVE_USAGE_IS_CUMULATIVE ? 'running total (last report)' : 'per turn (every report)',
    modes: out,
    fixed: {
      items: FIXED_MONTHLY_INR,
      knownMonthlyInr: knownFixed,
      perMinuteInr: allMinutes ? round(fixedForPeriod / allMinutes) : null,
    },
  };
}
