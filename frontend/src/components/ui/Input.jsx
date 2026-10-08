import React, { useId } from 'react';

// Same surface and focus treatment as Button's secondary variant, and the same
// 36px height as Button md, so a field and its submit button line up.
const FIELD = [
  'w-full bg-card dark:bg-white/[0.04]',
  'border border-border rounded-control shadow-xs',
  'text-sm text-foreground placeholder:text-muted-foreground/80',
  'hover:border-paper-700 dark:hover:border-white/20',
  'focus:outline-none focus:border-brand-450 focus:ring-[3px] focus:ring-brand-500/20',
  'aria-invalid:border-negative aria-invalid:focus:ring-negative/20',
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
  'transition-[border-color,box-shadow] duration-150',
].join(' ');
const CONTROL_HEIGHT = 'h-9';

// `icon` is a leading glyph; `trailing` is any node pinned to the right edge —
// a password reveal, a unit, a clear button. Making it a slot means no screen
// has to hand-position an absolute element over the field (and get it wrong).
export default function Input({ icon, trailing, className = '', ...props }) {
  return (
    <div className="relative">
      {icon && (
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 [--icon-size:17px] text-muted-foreground pointer-events-none">
          {icon}
        </span>
      )}
      <input
        className={`${FIELD} ${CONTROL_HEIGHT} ${icon ? 'pl-9' : 'pl-3'} ${trailing ? 'pr-11' : 'pr-3'} ${className}`}
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

// The native arrow differs per browser and ignores the theme, so it's hidden
// and a chevron is drawn in its place. `className` still lands on the
// <select> itself, as callers already size it that way.
export function Select({ className = '', children, ...props }) {
  // A caller that sizes the select itself (e.g. `!w-auto` in a toolbar) needs
  // the wrapper to shrink with it, or the chevron floats at the far edge.
  const sized = /(^|\s)!?w-(?!full)/.test(className);
  return (
    <span className={`relative ${sized ? 'inline-block' : 'block'}`}>
      <select className={`${FIELD} ${CONTROL_HEIGHT} appearance-none pl-3 pr-9 cursor-pointer ${className}`} {...props}>
        {children}
      </select>
      <span className="material-symbols-outlined pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 [--icon-size:18px] text-muted-foreground">
        expand_more
      </span>
    </span>
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
      ? React.cloneElement(children, { id, 'aria-invalid': error ? true : undefined })
      : children;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="block text-[13px] font-medium text-foreground mb-1.5">
          {label}
        </label>
      )}
      {control}
      {(error || hint) && (
        <p className={`mt-1.5 text-xs ${error ? 'text-negative-dim dark:text-negative' : 'text-muted-foreground'}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
