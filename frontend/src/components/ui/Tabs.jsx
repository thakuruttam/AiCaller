import React from 'react';

// Segmented control. Used for the notification status filter and the admin
// panel's sections — previously each screen drew its own.
//
// `items` is [{ value, label, count?, icon? }]. Rendered as real radio-ish
// buttons with aria-pressed so assistive tech reports the active segment.
export default function Tabs({ items, value, onChange, size = 'md', className = '' }) {
  const PAD = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]';

  return (
    <div className={`inline-flex items-center gap-0.5 bg-paper-300/80 dark:bg-white/[0.05] p-1 rounded-control ${className}`}>
      {items.map(item => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-field font-medium transition-[color,background-color,box-shadow] duration-150 cursor-pointer
              outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30 ${PAD} ${
              active
                ? 'bg-card dark:bg-white/[0.1] text-foreground shadow-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.icon && <span className="material-symbols-outlined [--icon-size:15px]">{item.icon}</span>}
            {item.label}
            {item.count != null && (
              <span className="tabular text-muted-foreground">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Underlined variant, for page-level sections where a segmented pill would be
// too heavy.
export function TabBar({ items, value, onChange, className = '' }) {
  return (
    <div className={`flex items-center gap-6 border-b border-border overflow-x-auto scrollbar-none ${className}`}>
      {items.map(item => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            aria-pressed={active}
            className={`relative inline-flex shrink-0 items-center gap-2 pb-3 -mb-px text-sm font-medium transition-colors cursor-pointer
              outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30 rounded-sm ${
              active
                ? 'text-foreground border-b-2 border-brand-500'
                : 'text-muted-foreground hover:text-foreground border-b-2 border-transparent'
            }`}
          >
            {item.icon && <span className="material-symbols-outlined [--icon-size:16px]">{item.icon}</span>}
            {item.label}
            {item.count != null && (
              <span className="tabular text-xs text-muted-foreground bg-paper-300 dark:bg-white/[0.06] rounded-full px-1.5 py-0.5">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
