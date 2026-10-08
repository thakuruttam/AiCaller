import React from 'react';

// The KPI tile from the Dashboard, shared by every screen with a metrics strip
// so figures read the same everywhere: a brand-tinted icon chip, a label, one
// large number, and an optional hint or trend line underneath. The chip is
// always the brand tint — colour in this app means brand or status, never
// decoration, so tiles don't each get their own hue.
const TREND_TONES = {
  up: 'text-positive-dim dark:text-positive',
  down: 'text-negative-dim dark:text-negative',
  neutral: 'text-muted-foreground',
};

// `icon` is a Material Symbols name or a ready element (e.g. a lucide icon).
// `trend` is { direction: 'up' | 'down' | 'neutral', label } and replaces
// `hint`; `children` renders below everything (a progress bar, chips).
export default function StatCard({
  icon,
  label,
  value,
  hint,
  trend,
  valueClassName = '',
  className = '',
  children,
}) {
  return (
    <div className={`flex min-h-28 flex-col gap-2 rounded-2xl bg-card dark:bg-muted p-5 shadow-primary ${className}`}>
      <div className="flex items-center gap-2">
        {icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-300">
            {typeof icon === 'string'
              ? <span className="material-symbols-outlined [--icon-size:20px]">{icon}</span>
              : icon}
          </span>
        )}
        <h3 className="text-sm font-medium text-foreground">{label}</h3>
      </div>
      <div className="mt-auto">
        <div className={`text-3xl font-normal tracking-wide tabular-nums text-foreground ${valueClassName}`}>{value}</div>
        {trend ? (
          <div className={`mt-2 flex items-center gap-1 text-sm ${TREND_TONES[trend.direction] ?? TREND_TONES.neutral}`}>
            {trend.direction !== 'neutral' && (
              <span className="material-symbols-outlined [--icon-size:18px]">
                {trend.direction === 'down' ? 'arrow_drop_down' : 'arrow_drop_up'}
              </span>
            )}
            <span>{trend.label}</span>
          </div>
        ) : hint != null && (
          <div className="mt-2 text-sm text-muted-foreground">{hint}</div>
        )}
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}
