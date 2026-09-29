import React, { useId } from 'react';

const FIELD = [
  'w-full bg-paper-100 dark:bg-ink-300',
  'border border-paper-500 dark:border-ink-400 rounded-control',
  'text-sm text-ink-100 dark:text-paper-200 placeholder:text-ink-700',
  'focus:outline-none focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/25',
  'disabled:opacity-50 disabled:cursor-not-allowed transition-shadow',
].join(' ');

// `icon` is a leading glyph; `trailing` is any node pinned to the right edge —
// a password reveal, a unit, a clear button. Making it a slot means no screen
// has to hand-position an absolute element over the field (and get it wrong).
export default function Input({ icon, trailing, className = '', ...props }) {
  return (
    <div className="relative">
      {icon && (
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 [--icon-size:18px] text-ink-700 pointer-events-none">
          {icon}
        </span>
      )}
      <input
        className={`${FIELD} h-10 ${icon ? 'pl-10' : 'pl-3'} ${trailing ? 'pr-11' : 'pr-3'} ${className}`}
        {...props}
      />
      {trailing && (
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center">
          {trailing}
        </span>
      )}
    </div>
  );
}

export function Textarea({ className = '', rows = 4, ...props }) {
  return <textarea rows={rows} className={`${FIELD} px-3 py-2.5 ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={`${FIELD} h-10 px-3 cursor-pointer ${className}`} {...props}>
      {children}
    </select>
  );
}

// Label + control + help/error, so screens stop hand-rolling this three-part
// stack. With no `htmlFor` it generates an id and stamps it on the child to
// keep the label bound. Passing `htmlFor` means the caller owns the binding —
// the child is left alone, which matters when it is a wrapper (an input with
// an adornment beside it), since stamping the id on a <div> silently breaks
// the label.
export function Field({ label, hint, error, htmlFor, children, className = '' }) {
  const generated = useId();
  const id = htmlFor || generated;
  const control =
    !htmlFor && React.isValidElement(children)
      ? React.cloneElement(children, { id })
      : children;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-ink-700 dark:text-ink-800 mb-1.5">
          {label}
        </label>
      )}
      {control}
      {(error || hint) && (
        <p className={`mt-1.5 text-xs ${error ? 'text-negative-dim' : 'text-ink-700 dark:text-ink-800'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
