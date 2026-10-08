import React from 'react';

import { TONE_DOT, TONE_PILL, toneForStatus, statusLabel } from './badgeTones';

// Tinted pill per tone — a status should be readable from its colour at a
// glance down a table column, which a grey pill with only a 6px dot isn't.
export default function Badge({ tone = 'neutral', dot = true, capitalize = true, className = '', children }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 whitespace-nowrap',
        'ring-1 ring-inset text-xs font-medium',
        TONE_PILL[tone] ?? TONE_PILL.neutral,
        capitalize ? 'capitalize' : '',
        className,
      ].join(' ')}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[tone]}`} />}
      {children}
    </span>
  );
}

// The one place a status string becomes a pill. Takes whatever spelling the
// API used — `completed`, `IN_PROGRESS`, `NO_ANSWER` — and renders it in the
// app's voice, so no screen needs its own colour map.
export function StatusBadge({ status, className = '' }) {
  return (
    <Badge tone={toneForStatus(status)} className={className}>
      {statusLabel(status)}
    </Badge>
  );
}
