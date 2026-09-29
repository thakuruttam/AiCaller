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

// Every status string the app uses, mapped once.
const STATUS_TONE = {
  active: 'positive', completed: 'positive', succeeded: 'positive', sent: 'positive',
  'in-progress': 'brand', running: 'brand', dialing: 'brand', queued: 'neutral',
  pending: 'neutral', draft: 'neutral', cancelled: 'neutral', 'no-answer': 'neutral',
  paused: 'caution', busy: 'caution', retrying: 'caution',
  failed: 'negative', error: 'negative', rejected: 'negative',
};

export function toneForStatus(status) {
  return STATUS_TONE[String(status ?? '').toLowerCase()] || 'neutral';
}
