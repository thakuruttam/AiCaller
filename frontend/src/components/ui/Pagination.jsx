import React from 'react';
import Button, { IconButton } from './Button';
import { Select } from './Input';
import { PAGE_SIZE_OPTIONS } from '../../hooks/usePagination';

// The one pagination control. Screens previously shipped two different
// designs — a Prev/Next pair and a numbered-page strip — which read as two
// different products. This covers both needs: page numbers when there is room
// (`compact={false}`) and a plain Prev/Next when there isn't.

export default function Pagination({
  page,
  totalPages,
  totalRows,
  pageSize,
  onPageChange,
  onPageSizeChange,
  compact = false,
  label = 'rows',
  className = '',
}) {
  if (!totalRows) return null;

  const pages = Math.max(1, totalPages);
  const goto = (p) => onPageChange(Math.min(Math.max(p, 1), pages));

  // A window of five around the current page, clamped to the ends.
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const window = [];
  for (let p = Math.max(1, start); p <= Math.min(pages, start + 4); p++) window.push(p);

  const from = Math.min((page - 1) * (pageSize || 0) + 1, totalRows);
  const to = pageSize ? Math.min(page * pageSize, totalRows) : totalRows;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 px-5 py-3
        border-t border-border ${className}`}
    >
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="tabular">
          {pageSize ? `Showing ${from}–${to} of ${totalRows} ${label}` : `${totalRows} ${label}`}
        </span>
        {onPageSizeChange && (
          <label className="flex items-center gap-2">
            <span className="whitespace-nowrap">Per page</span>
            <Select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
              className="!h-8 !w-auto !text-xs"
            >
              {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </label>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-1">
          {!compact && (
            <IconButton size="sm" title="First page" icon="first_page"
              onClick={() => goto(1)} disabled={page === 1} />
          )}
          <IconButton size="sm" title="Previous page" icon="chevron_left"
            onClick={() => goto(page - 1)} disabled={page === 1} />

          {compact ? (
            <span className="px-2 text-xs text-muted-foreground tabular">
              {page} / {pages}
            </span>
          ) : (
            window.map((p) => (
              <Button
                key={p}
                size="sm"
                variant={p === page ? 'secondary' : 'ghost'}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => goto(p)}
                className="!px-0 w-8 tabular"
              >
                {p}
              </Button>
            ))
          )}

          <IconButton size="sm" title="Next page" icon="chevron_right"
            onClick={() => goto(page + 1)} disabled={page === pages} />
          {!compact && (
            <IconButton size="sm" title="Last page" icon="last_page"
              onClick={() => goto(pages)} disabled={page === pages} />
          )}
        </div>
      )}
    </div>
  );
}
