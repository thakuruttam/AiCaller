import React from 'react';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function Pagination({ page, totalPages, totalRows, pageSize, onPageChange, onPageSizeChange }) {
  if (totalRows === 0) return null;

  const goto = (p) => onPageChange(Math.min(Math.max(p, 1), totalPages));

  // Compact page-number window: current page +/- 2, capped to [1, totalPages].
  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(totalPages, windowStart + 4);
  const pages = [];
  for (let p = windowStart; p <= windowEnd; p++) pages.push(p);

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 dark:border-slate-800 text-sm">
      <div className="flex items-center gap-4 text-zinc-500 dark:text-slate-400">
        <span>Total rows: {totalRows}</span>
        <label className="flex items-center gap-1.5">
          Rows per page
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="border border-zinc-200 dark:border-slate-600 rounded-md px-1.5 py-1 bg-white dark:bg-slate-800 text-zinc-700 dark:text-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30"
          >
            {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => goto(1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg text-zinc-400 dark:text-slate-500 hover:bg-zinc-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="First page"
        >
          <span className="material-symbols-outlined text-[16px] block">first_page</span>
        </button>
        <button
          onClick={() => goto(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg text-zinc-400 dark:text-slate-500 hover:bg-zinc-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Previous page"
        >
          <span className="material-symbols-outlined text-[16px] block">chevron_left</span>
        </button>

        {pages.map(p => (
          <button
            key={p}
            onClick={() => goto(p)}
            className={`w-7 h-7 rounded-full text-xs font-medium transition-colors ${
              p === page
                ? 'bg-[#0d9488] text-white'
                : 'text-zinc-600 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-700'
            }`}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => goto(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg text-zinc-400 dark:text-slate-500 hover:bg-zinc-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Next page"
        >
          <span className="material-symbols-outlined text-[16px] block">chevron_right</span>
        </button>
        <button
          onClick={() => goto(totalPages)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg text-zinc-400 dark:text-slate-500 hover:bg-zinc-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Last page"
        >
          <span className="material-symbols-outlined text-[16px] block">last_page</span>
        </button>
      </div>
    </div>
  );
}
