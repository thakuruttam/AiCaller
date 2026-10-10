import React from 'react';
import { Link } from 'react-router-dom';

// Every screen's outer frame: the grey ground the cards sit on, plus the same
// page-gutter (index.css) as the Dashboard and topbar, so every screen's
// edges line up with theirs instead of floating in a narrower centred
// column. Screens should not set their own page padding.
export default function Page({ className = '', children }) {
  return (
    <div className="bg-paper-300 dark:bg-ink-50 min-h-full">
      <div className={`page-gutter pt-5 pb-10 animate-fade-in ${className}`}>{children}</div>
    </div>
  );
}

// Below `md` the actions sit under the title instead of beside it. Side by
// side they used to be pinned right with `shrink-0`, which on a phone squeezed
// the subtitle into a tall column and pushed the buttons past the right edge,
// where nothing scrolled to reach them.
// "← Back to …" above a detail screen's title. One style everywhere — these
// had drifted into five different weights, colours and hover effects.
export function BackLink({ to, children, className = '' }) {
  return (
    <Link
      to={to}
      className={`group/back inline-flex items-center gap-1.5 rounded-field text-sm font-medium text-muted-foreground
        hover:text-foreground transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30 ${className}`}
    >
      <span className="material-symbols-outlined [--icon-size:18px] transition-transform group-hover/back:-translate-x-0.5">arrow_back</span>
      {children}
    </Link>
  );
}

// `back` is { to, label } for a detail screen's way out; `eyebrow` is a small
// label above the title (e.g. the record type).
export function PageHeader({ title, subtitle, icon, actions, back, eyebrow, className = '' }) {
  return (
    <div className={`mb-7 ${className}`}>
      {back && <BackLink to={back.to} className="mb-4">{back.label}</BackLink>}
      <div className="flex flex-col items-start gap-4 md:flex-row md:justify-between md:items-end md:gap-6">
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{eyebrow}</p>}
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            {icon && <span className="material-symbols-outlined [--icon-size:26px] text-brand-500 shrink-0">{icon}</span>}
            {title}
          </h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto md:shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}

// Centred icon / headline / one line of guidance / optional action. The copy
// should differ between "nothing here yet" and "nothing matched a filter",
// which is why `title` and `body` are both callers' business.
export function EmptyState({ icon = 'inbox', title, body, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center text-center py-16 animate-rise ${className}`}>
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <span className="material-symbols-outlined [--icon-size:26px] text-muted-foreground">{icon}</span>
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      {body && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// A number with its label, as used across the KPI strips.
export function Stat({ label, value, icon, tone = 'brand', badge }) {
  const TONES = {
    brand:    'bg-brand-500/10 text-brand-500',
    positive: 'bg-positive/10 text-positive-dim',
    caution:  'bg-caution/10 text-caution-dim',
    negative: 'bg-negative/10 text-negative-dim',
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-chip flex items-center justify-center ${TONES[tone]}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        {badge}
      </div>
      <p className="text-[13px] text-muted-foreground mb-1.5">{label}</p>
      <h3 className="text-5xl font-semibold text-foreground tabular">{value}</h3>
    </>
  );
}
