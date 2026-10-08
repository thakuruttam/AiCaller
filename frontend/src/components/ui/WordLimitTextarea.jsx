import React from 'react';
import { Textarea } from './Input';

function wordCount(text) {
  return text?.trim().split(/\s+/).filter(Boolean).length || 0;
}

// A Textarea with a live "N / limit words" counter pinned inside its bottom
// edge. Going over the limit marks the field invalid (red border) and says so
// in the counter, but never blocks typing — the step's own validation
// decides whether the form can advance. Extra props (id, aria-*) reach the
// textarea, so a wrapping <Field> label stays bound to it.
export default function WordLimitTextarea({
  value,
  onChange,
  limit,
  rows = 2,
  className = '',
  style,
  ...props
}) {
  const count = wordCount(value);
  const over = count > limit;
  return (
    <div className="relative w-full">
      <Textarea
        rows={rows}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={over || undefined}
        className={`pb-7 resize-y ${className}`}
        style={style}
        {...props}
      />
      <span
        className={`pointer-events-none absolute bottom-2 right-3 rounded-field px-1 text-xs font-medium tabular-nums
          bg-card/90 dark:bg-muted/90 backdrop-blur-sm ${over ? 'text-negative-dim dark:text-negative font-semibold' : 'text-muted-foreground'}`}
      >
        {count} / {limit} words{over ? ' — over limit' : ''}
      </span>
    </div>
  );
}
