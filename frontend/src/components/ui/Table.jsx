import React from 'react';

// Table chrome lives here so row height, gutters and hairlines stay identical
// across every screen. `tabular-nums` comes from the global table rule in
// index.css, so figures already line up column-to-column.
export default function Table({ className = '', children }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left ${className}`}>{children}</table>
    </div>
  );
}

export function THead({ className = '', children }) {
  return (
    <thead className={`bg-paper-200 dark:bg-ink-50 border-b border-paper-400 dark:border-ink-400 ${className}`}>
      <tr>{children}</tr>
    </thead>
  );
}

// Column labels sit in sentence case behind a muted glyph, not as uppercase
// letter-spaced text — the heading should recede, not shout.
export function Th({ icon, align = 'left', className = '', children }) {
  return (
    <th className={`px-7 py-4 text-xs font-medium text-ink-700 dark:text-ink-800 ${align === 'right' ? 'text-right' : ''} ${className}`}>
      <span className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}>
        {icon && <span className="material-symbols-outlined [--icon-size:15px] text-ink-800">{icon}</span>}
        {children}
      </span>
    </th>
  );
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-paper-400 dark:divide-ink-400">{children}</tbody>;
}

export function Tr({ className = '', children, ...props }) {
  return (
    <tr className={`hover:bg-paper-200 dark:hover:bg-ink-300/60 transition-colors ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function Td({ align = 'left', className = '', children, ...props }) {
  return (
    <td className={`px-7 py-5 text-sm text-ink-100 dark:text-paper-200 ${align === 'right' ? 'text-right' : ''} ${className}`} {...props}>
      {children}
    </td>
  );
}

// Record names read as links in the reference — underlined, with the rule
// lighter than the text so it never competes with it.
export function RecordLink({ as: asProp = 'a', className = '', children, ...props }) {
  const As = asProp;
  return (
    <As
      className={`text-sm font-medium text-ink-100 dark:text-paper-200 underline decoration-paper-800 dark:decoration-ink-600 underline-offset-[3px] hover:decoration-ink-600 dark:hover:decoration-ink-800 transition-colors ${className}`}
      {...props}
    >
      {children}
    </As>
  );
}

export function SkeletonRow({ cols = 5 }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-7 py-5">
          <div className="h-4 bg-paper-400 dark:bg-ink-400 rounded-field" style={{ width: `${40 + ((i * 17) % 45)}%` }} />
        </td>
      ))}
    </tr>
  );
}
