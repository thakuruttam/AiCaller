// Status→tone mapping lives outside Badge.jsx so that file exports only
// components (fast refresh works per-module, and a mixed module invalidates
// the whole thing on every edit).
export const TONE_DOT = {
  neutral:  'bg-ink-800',
  positive: 'bg-positive',
  caution:  'bg-caution',
  negative: 'bg-negative',
  brand:    'bg-brand-500',
};

export const TONE_PILL = {
  neutral:  'bg-paper-300/70 text-muted-foreground ring-paper-600 dark:bg-white/[0.05] dark:ring-white/10',
  positive: 'bg-positive/10 text-positive-dim ring-positive/25 dark:text-positive dark:ring-positive/20',
  caution:  'bg-caution/10 text-caution-dim ring-caution/30 dark:text-caution dark:ring-caution/20',
  negative: 'bg-negative/10 text-negative-dim ring-negative/25 dark:text-negative dark:ring-negative/20',
  brand:    'bg-brand-500/10 text-brand-600 ring-brand-500/25 dark:text-brand-300 dark:ring-brand-500/30',
};

// Every status string the app uses, mapped once.
const STATUS_TONE = {
  active: 'positive', completed: 'positive', succeeded: 'positive', sent: 'positive',
  'in-progress': 'brand', running: 'brand', dialing: 'brand', queued: 'neutral',
  pending: 'neutral', draft: 'neutral', cancelled: 'neutral', 'no-answer': 'neutral',
  paused: 'caution', busy: 'caution', retrying: 'caution',
  failed: 'negative', error: 'negative', rejected: 'negative',
  // Support ticket lifecycle — same vocabulary, same colours.
  open: 'brand', scheduled: 'brand', resolved: 'positive', closed: 'neutral',
  // Evaluation-service call outcomes.
  incomplete: 'caution', 'wrong-person': 'negative', reschedule: 'brand',
};

// Statuses reach us in several shapes for the same thing — `NO_ANSWER` from
// the eval service, `no-answer` from telephony — so normalise before lookup
// rather than carrying a key per spelling.
export function toneForStatus(status) {
  const key = String(status ?? '').toLowerCase().replace(/_/g, '-');
  return STATUS_TONE[key] || 'neutral';
}

// The same normalisation, for display: `NO_ANSWER` and `no-answer` both read
// as `No answer` once Badge's `capitalize` lifts the first letter. The
// separators are an artefact of how each service spells its enum, not
// something a reader should see.
export function statusLabel(status) {
  return String(status ?? '').toLowerCase().replace(/[_-]/g, ' ');
}
