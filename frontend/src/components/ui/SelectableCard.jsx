import React from 'react';

// A card that behaves as a choice — pricing packs, plan pickers, template
// tiles. Previously these were `<div onClick>`, which cannot be reached or
// activated from a keyboard; this renders a real button with the right role
// and selected state, so the affordance is correct everywhere it's used.
export default function SelectableCard({
  selected = false,
  onSelect,
  badge,
  disabled = false,
  // `compact` drops the check circle and tightens the padding — for rows of
  // small choice tiles where a full card would dominate the form.
  compact = false,
  className = '',
  children,
  ...props
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={[
        'relative flex flex-col text-left rounded-xl border w-full',
        compact ? 'p-3 gap-0.5' : 'p-5',
        'transition-[border-color,box-shadow,background-color] duration-200',
        'outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30',
        'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        selected
          ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500'
          : 'border-border bg-card dark:bg-white/[0.03] shadow-xs hover:border-paper-800 dark:hover:border-white/20',
        className,
      ].join(' ')}
      {...props}
    >
      {badge && <span className="absolute -top-3 right-3">{badge}</span>}

      {/* Selection indicator doubles as the visual check. */}
      {!compact && (
        <span
          aria-hidden="true"
          className={`absolute top-3 left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            selected ? 'border-brand-500 bg-brand-500' : 'border-paper-800 dark:border-white/25'
          }`}
        >
          {selected && (
            <span className="material-symbols-outlined text-white [--icon-size:13px]">check</span>
          )}
        </span>
      )}

      <span className={`flex-1 block ${compact ? '' : 'pt-4'}`}>{children}</span>
    </button>
  );
}
