// What each paid service charges us, used to price the usage recorded on
// every call (CallLog.usage) for the super-admin cost breakdown on the Usage
// page. These are OUR costs, never shown to workspaces.
//
// Sources and dates are noted per line — recheck when a bill disagrees.
// Prices are before GST / card forex fees.

/** Rupees per US dollar for converting USD-billed services. */
export const USD_TO_INR = Number(process.env.COST_USD_TO_INR || 85);

/** Plivo, India outbound — read from Plivo's own call records (API) on 2026-11-06. */
export const PLIVO = {
  perMinuteUsd: Number(process.env.COST_PLIVO_PER_MIN_USD || 0.00475),
  pulseSeconds: 30, // billed in 30-second pulses
};

/**
 * Gemini Live, USD per 1M tokens. gemini-3.1-flash-live-preview list prices
 * as published by third-party trackers (Oct–Nov 2026) — preview, may change.
 */
export const GEMINI_LIVE = {
  default: { textInPerM: 0.75, audioInPerM: 3, textOutPerM: 4.5, audioOutPerM: 12 },
};

/**
 * Whether Gemini Live's usageMetadata is a running session total (price only
 * the last report) or per turn (price every report). Google's docs conflict;
 * per turn is the default. Reconcile against the Google bill and flip
 * GEMINI_LIVE_USAGE_IS_CUMULATIVE=true if the bill matches "last report".
 */
export const GEMINI_LIVE_USAGE_IS_CUMULATIVE = process.env.GEMINI_LIVE_USAGE_IS_CUMULATIVE === 'true';

/** Sarvam speech-to-text (saaras:v3), ₹ per minute of audio — docs.sarvam.ai pay-as-you-go, Nov 2026. */
export const SARVAM_PER_MINUTE_INR = Number(process.env.COST_SARVAM_PER_MIN_INR || 0.49);

/** Text models, USD per 1M tokens, matched by model-name prefix. */
export const TEXT_MODELS = [
  { prefix: 'gpt-4.1-mini', inPerM: 0.4, outPerM: 1.6 },
  { prefix: 'gemini-3.6-flash', inPerM: 0.75, outPerM: 3.75 }, // reported to rise to 1.50 / 7.50 on 2027-01-01
  { prefix: 'gemini-3.8-flash', inPerM: 0.75, outPerM: 3.75 },
  { prefix: 'gemini-3.5-flash', inPerM: 1.5, outPerM: 9 },
];

/**
 * Fixed monthly costs, ₹, spread over the period's call minutes. `null`
 * means "not known yet" — fill in from the real bill.
 */
export const FIXED_MONTHLY_INR = [
  { item: 'AWS EC2 t3.small (Mumbai, on-demand)', inr: 1390 },
  { item: 'AWS public IPv4 / Elastic IP', inr: 310 },
  { item: 'AWS EBS disk', inr: 150 },
  { item: 'Plivo phone number (+91 22 6423 2402)', inr: 212 }, // $2.50/month, Plivo API
  { item: 'Domain aicaller.store', inr: 80 },
  { item: 'MongoDB Atlas', inr: null, note: 'Tier not confirmed — check the Atlas bill' },
  { item: 'Vercel', inr: null, note: 'Hobby is free but not for commercial use; Pro is $20/user' },
];
