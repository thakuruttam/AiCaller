import React from 'react';

// Every screen's outer frame: the grey ground the white cards sit on, plus a
// generous, consistent gutter. Screens should not set their own page padding.
export default function Page({ className = '', children }) {
  return (
    <div className="ui-inter bg-paper-300 dark:bg-ink-50 min-h-full">
      <div className={`p-10 max-w-[1440px] mx-auto animate-fade-in ${className}`}>{children}</div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, className = '' }) {
  return (
    <div className={`flex justify-between items-end gap-6 mb-10 ${className}`}>
      <div>
        <h1 className="text-[22px] font-semibold text-ink-100 dark:text-paper-200">{title}</h1>
        {subtitle && <p className="text-sm text-ink-600 dark:text-ink-900 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0">{actions}</div>}
    </div>
  );
}

// Centred icon / headline / one line of guidance / optional action. The copy
// should differ between "nothing here yet" and "nothing matched a filter",
// which is why `title` and `body` are both callers' business.
export function EmptyState({ icon = 'inbox', title, body, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center text-center py-16 animate-rise ${className}`}>
      <div className="w-10 h-10 rounded-chip bg-paper-300 dark:bg-ink-300 flex items-center justify-center mb-3">
        <span className="material-symbols-outlined [--icon-size:20px] text-ink-800">{icon}</span>
      </div>
      <p className="text-sm font-medium text-ink-100 dark:text-paper-200">{title}</p>
      {body && <p className="text-[13px] text-ink-700 dark:text-ink-800 mt-1 max-w-sm">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// A number with its label, as used across the KPI strips.
export function Stat({ label, value, icon, tone = 'brand', badge }) {
  const TONES = {
    brand:    'bg-brand-100 dark:bg-brand-500/15 text-brand-500',
    positive: 'bg-positive/10 dark:bg-positive/15 text-positive-dim',
    caution:  'bg-caution/10 dark:bg-caution/15 text-caution-dim',
    negative: 'bg-negative/10 dark:bg-negative/15 text-negative-dim',
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-chip flex items-center justify-center ${TONES[tone]}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        {badge}
      </div>
      <p className="text-[13px] text-ink-700 dark:text-ink-800 mb-1.5">{label}</p>
      <h3 className="text-5xl font-semibold text-ink-100 dark:text-paper-200 tabular">{value}</h3>
    </>
  );
}
