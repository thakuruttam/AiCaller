import React from 'react';

import { TONE_DOT, toneForStatus } from './badgeTones';

export default function Badge({ tone = 'neutral', dot = true, className = '', children }) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-field px-2.5 py-1',
        'border border-paper-500 dark:border-ink-400 bg-paper-200 dark:bg-ink-300/50',
        'text-xs font-medium capitalize text-ink-600 dark:text-ink-900',
        className,
      ].join(' ')}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TONE_DOT[tone]}`} />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  return <Badge tone={toneForStatus(status)}>{status}</Badge>;
}
