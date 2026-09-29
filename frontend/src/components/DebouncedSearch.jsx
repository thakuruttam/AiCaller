import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

export default function DebouncedSearch({
  onSearch,
  placeholder = 'Search…',
  delay = 0,
  className = '',
}) {
  const [value, setValue] = useState('');

  // Callers commonly pass an inline arrow function (e.g. to close over a
  // per-row id), which is a new reference every render. Keeping onSearch out
  // of the effect's dependency array and reading it from a ref instead means
  // a caller re-render never re-triggers this effect on its own — only a real
  // change to `value`/`delay` does. Without this, an inline onSearch created
  // a genuine infinite loop: effect fires -> calls onSearch -> parent state
  // updates -> parent re-renders -> new onSearch reference -> effect fires
  // again, forever (this was also stalling unrelated route navigations by
  // starving React's render loop while it happened).
  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  // Every current usage of this component filters data that's already
  // loaded client-side (no API call), so there's nothing to debounce —
  // a nonzero delay only opens a window where the visible list doesn't
  // match what's in the search box yet. Default to instant; callers that
  // ever wire this to a real server-side search can still pass `delay`.
  useEffect(() => {
    if (delay <= 0) {
      onSearchRef.current(value);
      return;
    }
    const t = setTimeout(() => onSearchRef.current(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search size={14} className="absolute left-3 text-ink-800 dark:text-ink-800 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-control border border-paper-500 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 pl-8 pr-4 text-sm text-ink-100 dark:text-paper-200 placeholder:text-ink-800 dark:placeholder:text-ink-700 shadow-card focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/15 transition-all duration-150"
      />
    </div>
  );
}
