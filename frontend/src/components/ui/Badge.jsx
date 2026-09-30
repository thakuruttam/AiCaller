import React from 'react';

import { TONE_DOT, toneForStatus, statusLabel } from './badgeTones';

export default function Badge({ tone = 'neutral', dot = true, capitalize = true, className = '', children }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-field px-2.5 py-1',
        'border border-paper-500 dark:border-ink-400 bg-paper-200 dark:bg-ink-300/50',
        'text-xs font-medium text-ink-600 dark:text-ink-900',
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
