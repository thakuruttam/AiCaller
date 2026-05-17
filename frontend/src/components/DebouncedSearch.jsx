import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

export default function DebouncedSearch({ 
  onSearch, 
  placeholder = "Search...", 
  delay = 300,
  className = ""
}) {
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(inputValue);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [inputValue, onSearch, delay]);

  return (
    <div className={`relative flex items-center ${className}`}>
      <Search 
        size={16} 
        className="absolute left-3 text-muted-foreground" 
      />
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-4 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
    </div>
  );
}
