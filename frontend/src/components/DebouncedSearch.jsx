import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

export default function DebouncedSearch({
  onSearch,
  placeholder = 'Search…',
  delay = 300,
  className = '',
}) {
  const [value, setValue] = useState('');

  useEffect(() => {
    const t = setTimeout(() => onSearch(value), delay);
    return () => clearTimeout(t);
  }, [value, onSearch, delay]);

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search size={14} className="absolute left-3 text-zinc-400 dark:text-slate-500 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 pl-8 pr-4 text-sm text-zinc-900 dark:text-slate-100 placeholder:text-zinc-400 dark:placeholder:text-slate-500 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 transition-all duration-150"
      />
    </div>
  );
}
