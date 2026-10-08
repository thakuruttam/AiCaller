import React from 'react';
import { Skeleton } from './Feedback';

// Table chrome lives here so row height, gutters and hairlines stay identical
// across every screen. The look follows the data tables in Linear, Vercel and
// Stripe: a quiet tinted header, sentence-case muted labels, ~52px rows split
// by hairlines, and controls that stay out of the way until a row is hovered.
// `tabular-nums` comes from the global table rule in index.css, so figures
// already line up column-to-column.
//
// Cells pad px-4, with the outer columns at px-5 so the first and last
// columns line up with the card's toolbar and pagination above and below.
const CELL_X = 'px-4 first:pl-5 last:pr-5';

export default function Table({ className = '', style, children }) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table style={style} className={`w-full text-left text-sm ${className}`}>{children}</table>
    </div>
  );
}

// `sticky` pins the header while a scroll container around the table moves;
// it only has an effect when an ancestor scrolls, not the page.
export function THead({ sticky = false, className = '', children, ref }) {
  return (
    <thead
      ref={ref}
      className={`bg-paper-200/70 dark:bg-white/[0.02] border-b border-border
        ${sticky ? 'sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-paper-200/80 dark:supports-[backdrop-filter]:bg-muted/90' : ''}
        ${className}`}
    >
      <tr>{children}</tr>
    </thead>
  );
}

// `sort` is the column's current direction ('asc' | 'desc' | null); passing
// `onSort` turns the label into a button. Unsorted sortable columns only show
// their arrow on hover, so a header full of sortable columns doesn't read as
// a row of icons.
export function Th({ icon, align = 'left', sort, onSort, className = '', children }) {
  const right = align === 'right';
  const label = (
    <>
      {icon && <span className="material-symbols-outlined [--icon-size:14px] opacity-70">{icon}</span>}
      {children}
    </>
  );

  return (
    <th
      scope="col"
      aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : undefined}
      className={`h-10 ${CELL_X} text-xs font-medium text-muted-foreground whitespace-nowrap select-none ${right ? 'text-right' : ''} ${className}`}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className={`group/sort inline-flex items-center gap-1 -mx-1.5 px-1.5 py-1 rounded-field cursor-pointer
            hover:text-foreground hover:bg-paper-300/70 dark:hover:bg-white/[0.04] transition-colors
            outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40
            ${sort ? 'text-foreground' : ''} ${right ? 'flex-row-reverse' : ''}`}
        >
          {label}
          <span
            className={`material-symbols-outlined [--icon-size:14px] transition-opacity
              ${sort ? 'opacity-100' : 'opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60'}`}
          >
            {sort === 'desc' ? 'arrow_downward' : 'arrow_upward'}
          </span>
        </button>
      ) : (
        <span className={`inline-flex items-center gap-1.5 ${right ? 'justify-end' : ''}`}>{label}</span>
      )}
    </th>
  );
}

export function TBody({ className = '', children }) {
  return <tbody className={`divide-y divide-border ${className}`}>{children}</tbody>;
}

// A row with `onClick` is a navigation target, so it's also reachable and
// activatable from the keyboard — a clickable <tr> is otherwise mouse-only.
// Controls inside such a row should stopPropagation so they don't navigate.
export function Tr({ selected = false, onClick, className = '', children, ...props }) {
  const interactive = typeof onClick === 'function';
  return (
    <tr
      onClick={onClick}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick(e);
        }
      } : undefined}
      aria-selected={selected || undefined}
      className={`group/row transition-colors
        ${selected ? 'bg-brand-500/10' : 'hover:bg-paper-200/80 dark:hover:bg-white/[0.03]'}
        ${interactive ? 'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40' : ''}
        ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}

// `muted` is for supporting columns (dates, emails, owners) so the eye lands
// on the record name first; `numeric` right-aligns figures so their digits
// stack.
export function Td({ align = 'left', muted = false, numeric = false, className = '', children, ...props }) {
  const right = numeric || align === 'right';
  return (
    <td
      className={`${CELL_X} py-3 align-middle ${muted ? 'text-muted-foreground' : 'text-foreground'}
        ${right ? 'text-right' : ''} ${numeric ? 'tabular-nums whitespace-nowrap' : ''} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}

// Record name with an optional second line of context (created date, phone,
// id) — the two-line cell every reference table leads with.
export function CellStack({ title, meta, className = '' }) {
  return (
    <div className={`flex flex-col min-w-0 ${className}`}>
      <span className="text-sm font-medium text-foreground truncate">{title}</span>
      {meta != null && meta !== '' && (
        <span className="text-xs text-muted-foreground truncate">{meta}</span>
      )}
    </div>
  );
}

// Row-level controls. Hidden until the row is hovered or a control inside it
// takes focus, so a long table isn't a column of identical buttons — but only
// on devices that can hover; on touch screens they are always shown. An open
// menu inside keeps them visible, since its portal takes focus out of the row.
export function RowActions({ className = '', children, ...props }) {
  return (
    <div
      className={`flex items-center justify-end gap-0.5 transition-opacity
        [@media(hover:hover)]:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100
        has-[[aria-expanded=true]]:opacity-100
        ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

// The strip above a table: title with a row count on the left, then whatever
// filters/search the screen passes, and actions pinned right.
export function TableToolbar({ title, count, actions, className = '', children }) {
  return (
    <div className={`flex flex-col gap-3 px-5 py-3.5 border-b border-border md:flex-row md:items-center md:justify-between ${className}`}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        {title && (
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground whitespace-nowrap">
            {title}
            {count != null && (
              <span className="rounded-full bg-paper-300 dark:bg-white/[0.06] px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {count}
              </span>
            )}
          </h4>
        )}
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  );
}

// Record names read as links in the reference — underlined, with the rule
// lighter than the text so it never competes with it.
export function RecordLink({ as: asProp = 'a', className = '', children, ...props }) {
  const As = asProp;
  return (
    <As
      className={`text-sm font-medium text-foreground underline decoration-paper-800 dark:decoration-ink-600 underline-offset-[3px] hover:decoration-ink-600 dark:hover:decoration-ink-800 transition-colors ${className}`}
      {...props}
    >
      {children}
    </As>
  );
}

export function SkeletonRow({ cols = 5 }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className={`${CELL_X} py-3.5`}>
          <Skeleton height="0.875rem" width={`${40 + ((i * 17) % 45)}%`} />
        </td>
      ))}
    </tr>
  );
}
