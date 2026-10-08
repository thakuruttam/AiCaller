import React, { useState, useEffect, useRef } from 'react';
import { Input } from './ui';

// Pass `value` to let the parent clear or set the box (e.g. a "Clear filters"
// action); without it the box keeps its own text, as before.
export default function DebouncedSearch({
  onSearch,
  value: controlled,
  placeholder = 'Search…',
  delay = 0,
  className = '',
}) {
  const [value, setValue] = useState(controlled ?? '');

  useEffect(() => {
    if (controlled !== undefined) setValue(controlled);
  }, [controlled]);

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
    <div className={className}>
      <Input
        type="search"
        icon="search"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}
