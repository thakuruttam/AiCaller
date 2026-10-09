import React from 'react';

// ── Skeleton ────────────────────────────────────────────────────────────────
// A shimmering placeholder reads as "loading"; a static grey block reads as
// "empty". Width is a prop so a skeleton can echo the shape of what's coming.
export function Skeleton({ className = '', width, height = '1rem', rounded = 'rounded-field' }) {
  return (
    <span
      aria-hidden="true"
      className={`block bg-paper-400 dark:bg-ink-400 overflow-hidden ${rounded} ${className}`}
      style={{ width, height }}
    >
      <span className="skeleton block w-full h-full" />
    </span>
  );
}

export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height="0.75rem" width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}

// ── Alert ───────────────────────────────────────────────────────────────────
const ALERT_TONES = {
  info:     { wrap: 'bg-brand-500/10 border-brand-500/25', icon: 'info',         fg: 'text-brand-600 dark:text-brand-300' },
  positive: { wrap: 'bg-positive/10 border-positive/25',  icon: 'check_circle', fg: 'text-positive-dim' },
  caution:  { wrap: 'bg-caution/10 border-caution/25',    icon: 'warning',      fg: 'text-caution-dim' },
  negative: { wrap: 'bg-negative/10 border-negative/25',  icon: 'error',        fg: 'text-negative-dim' },
};

export function Alert({ tone = 'info', title, children, action, onDismiss, className = '' }) {
  const t = ALERT_TONES[tone] ?? ALERT_TONES.info;

  return (
    <div role="status" className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${t.wrap} ${className}`}>
      <span className={`material-symbols-outlined [--icon-size:18px] shrink-0 mt-0.5 ${t.fg}`}>{t.icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="text-[13px] font-semibold text-foreground">{title}</p>}
        {children && <div className="text-[13px] text-muted-foreground mt-0.5">{children}</div>}
      </div>
      {action}
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-field text-muted-foreground hover:text-foreground transition-colors cursor-pointer outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30"
        >
          <span className="material-symbols-outlined [--icon-size:16px]">close</span>
        </button>
      )}
    </div>
  );
}

// ── Progress ────────────────────────────────────────────────────────────────
export function Progress({ value = 0, tone = 'brand', className = '', showValue = false, label }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const TONES = {
    brand: 'bg-brand-500', positive: 'bg-positive',
    caution: 'bg-caution', negative: 'bg-negative',
  };

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs text-muted-foreground">{label}</span>}
          {showValue && <span className="text-xs font-medium text-foreground tabular">{pct}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full rounded-full bg-paper-400 dark:bg-white/10 overflow-hidden"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${TONES[tone]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Avatar ──────────────────────────────────────────────────────────────────
const AVATAR_SIZES = { xs: 'w-6 h-6 text-[10px]', sm: 'w-8 h-8 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-12 h-12 text-base' };

export function Avatar({ name, src, size = 'md', className = '' }) {
  const initials = String(name || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <span
      title={name}
      className={`inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden
                  bg-brand-500 text-white font-semibold ${AVATAR_SIZES[size]} ${className}`}
    >
      {src ? <img src={src} alt={name || ''} className="w-full h-full object-cover" /> : initials}
    </span>
  );
}

// ── Tooltip ─────────────────────────────────────────────────────────────────
// CSS-only: no portal, no positioning library. Good enough for short labels on
// icon controls, which is all this app needs.
export function Tooltip({ label, side = 'top', children, className = '' }) {
  const SIDE = {
    top:    'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left:   'right-full top-1/2 -translate-y-1/2 mr-2',
    right:  'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span className={`group/tip relative inline-flex ${className}`}>
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-field
                    bg-foreground px-2 py-1 text-xs font-medium text-background shadow-overlay
                    opacity-0 scale-95 transition-all duration-150
                    group-hover/tip:opacity-100 group-hover/tip:scale-100
                    group-focus-within/tip:opacity-100 group-focus-within/tip:scale-100
                    ${SIDE[side]}`}
      >
        {label}
      </span>
    </span>
  );
}

// ── Divider ─────────────────────────────────────────────────────────────────
export function Divider({ label, className = '' }) {
  if (!label) return <hr className={`border-t border-border ${className}`} />;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <hr className="flex-1 border-t border-border" />
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
      <hr className="flex-1 border-t border-border" />
    </div>
  );
}
