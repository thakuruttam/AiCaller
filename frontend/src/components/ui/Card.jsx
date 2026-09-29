import React from 'react';

// Surfaces are separated by a hairline, not elevation — shadow-card is barely
// there on purpose. `padded={false}` is for cards that own their own layout,
// like one wrapping a full-bleed table.
export default function Card({ padded = true, interactive = false, className = '', children, ...props }) {
  return (
    <div
      className={[
        'bg-paper-100 dark:bg-ink-200',
        'border border-paper-500 dark:border-ink-400',
        'rounded-card shadow-card',
        padded ? 'p-7' : '',
        interactive ? 'hover:shadow-raised hover:-translate-y-px transition-[box-shadow,transform] duration-200' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

// Card header with the reference's layout: a muted label on the left, optional
// affordances on the right.
export function CardHeader({ title, icon, action, className = '' }) {
  return (
    <div className={`flex items-center justify-between mb-5 ${className}`}>
      <div className="flex items-center gap-2">
        {icon && (
          <span className="material-symbols-outlined [--icon-size:16px] text-ink-800">{icon}</span>
        )}
        <h3 className="text-[13px] font-medium text-ink-700 dark:text-ink-800">{title}</h3>
      </div>
      {action}
    </div>
  );
}
