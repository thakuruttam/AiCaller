import React from 'react';

// Native checkboxes render inconsistently across engines (and were showing as
// solid dark squares here), so the box is drawn explicitly: appearance-none
// plus an SVG tick that only shows when checked. Keeps the control on the same
// hairline / brand language as the rest of the system.
export default function Checkbox({ className = '', indeterminate = false, ...props }) {
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        className="peer appearance-none w-4 h-4 m-0 rounded-[4px] cursor-pointer bg-card dark:bg-white/[0.04] border border-paper-800 dark:border-white/25 shadow-xs
                   checked:bg-brand-500 checked:border-brand-500
                   indeterminate:bg-brand-500 indeterminate:border-brand-500
                   hover:border-brand-500
                   focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors"
        {...props}
      />
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
      >
        <path d="M4 8.5l2.5 2.5L12 5.5" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-4 h-4 text-white opacity-0 peer-indeterminate:opacity-100 transition-opacity"
      >
        <path d="M4.5 8h7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}
