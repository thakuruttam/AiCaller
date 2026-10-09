import React from 'react';

// Same surface as the Dashboard's KPI and table cards: no hairline border, a
// soft shadow-primary ring and a 16px radius (tokens from web3-dashboard/
// dashboard.css). `padded={false}` is for cards that own their own layout,
// like one wrapping a full-bleed table.
export default function Card({ padded = true, interactive = false, className = '', children, ...props }) {
  return (
    <div
      className={[
        'bg-card dark:bg-muted rounded-2xl shadow-primary',
        padded ? 'p-5' : '',
        interactive ? 'hover:-translate-y-px transition-transform duration-200' : '',
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
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div className="flex items-center gap-2">
        {icon && (
          <span className="material-symbols-outlined [--icon-size:16px] text-muted-foreground">{icon}</span>
        )}
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      {action}
    </div>
  );
}
