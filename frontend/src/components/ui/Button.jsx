import React from 'react';
import Spinner from '../Spinner';

// Every button in the app comes from here. A variant carries the whole visual
// contract — fill, hairline, hover, disabled and focus ring — so no screen has
// to restate it, and so the focus ring can never be forgotten.
const VARIANTS = {
  // Solid accent. One per view, on the primary action.
  primary:
    'bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-600 ' +
    'disabled:bg-paper-500 disabled:text-ink-800 dark:disabled:bg-ink-400 dark:disabled:text-ink-700',
  // Bordered surface. The default for everything that isn't the main action.
  // In dark mode this sits one step ABOVE the card surface (ink-300 vs the
  // card's ink-200). At the same value it vanished into any card it was
  // placed on, leaving only the hairline to suggest a control was there.
  secondary:
    'bg-paper-100 dark:bg-ink-300 text-ink-100 dark:text-paper-200 ' +
    'border border-paper-500 dark:border-ink-400 ' +
    'hover:bg-paper-300 dark:hover:bg-ink-400 hover:border-paper-600 dark:hover:border-ink-500',
  // Tinted, no border — for accent actions that shouldn't compete with primary.
  subtle:
    'bg-brand-100 dark:bg-brand-500/15 text-brand-600 dark:text-brand-300 hover:bg-brand-200 dark:hover:bg-brand-500/25',
  // No chrome until hovered. Toolbars, table rows, dismissals.
  ghost:
    'text-ink-600 dark:text-ink-900 hover:bg-paper-300 dark:hover:bg-ink-300 hover:text-ink-100 dark:hover:text-white',
  // Destructive. Deliberately quiet until hovered so it isn't the loudest
  // thing on screen just because it's dangerous.
  danger:
    'bg-negative text-white hover:bg-negative-dim',
  dangerGhost:
    'text-ink-600 dark:text-ink-900 hover:bg-negative/10 hover:text-negative-dim',
  // Reads as a link, behaves as a button.
  link:
    'text-brand-500 hover:text-brand-600 hover:underline underline-offset-[3px] !px-0 !h-auto',
};

const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1',
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-sm gap-2',
};

const ICON_SIZE = { xs: 14, sm: 15, md: 17, lg: 18 };

const Button = React.forwardRef(function Button({
  as: As = 'button',
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  children,
  ...props
}, ref) {
  const isDisabled = disabled || loading;
  const glyph = (name) => (
    <span className="material-symbols-outlined" style={{ ['--icon-size']: `${ICON_SIZE[size]}px` }}>
      {name}
    </span>
  );

  return (
    <As
      ref={ref}
      disabled={As === 'button' ? isDisabled : undefined}
      aria-disabled={As !== 'button' && isDisabled ? true : undefined}
      className={[
        'inline-flex items-center justify-center rounded-control font-semibold whitespace-nowrap',
        'transition-colors outline-none cursor-pointer select-none',
        'focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2',
        'focus-visible:ring-offset-paper-100 dark:focus-visible:ring-offset-ink-100',
        'disabled:cursor-not-allowed disabled:opacity-100 active:scale-[0.98]',
        VARIANTS[variant] ?? VARIANTS.primary,
        SIZES[size],
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
      {...props}
    >
      {loading ? <Spinner size={ICON_SIZE[size]} /> : icon && glyph(icon)}
      {children}
      {iconRight && !loading && glyph(iconRight)}
    </As>
  );
});

export default Button;

// Square, label-less action — table row controls, toolbar affordances. `title`
// is required by convention and doubles as the accessible name: an icon with
// no name is not a usable control.
const ICON_BUTTON_SIZES = {
  sm: 'p-1.5 [--icon-size:16px]',
  md: 'p-2 [--icon-size:20px]',
  lg: 'p-2.5 [--icon-size:22px]',
};

export const IconButton = React.forwardRef(function IconButton({
  as: asProp = 'button',
  icon,
  tone = 'neutral',
  size = 'md',
  loading = false,
  className = '',
  title,
  children,
  ...props
}, ref) {
  const As = asProp;
  const TONES = {
    neutral: 'text-ink-600 dark:text-ink-900 hover:bg-paper-300 dark:hover:bg-ink-400 hover:text-ink-100 dark:hover:text-white',
    brand:   'text-brand-500 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-500/15',
    danger:  'text-ink-600 dark:text-ink-900 hover:bg-negative/10 hover:text-negative-dim',
  };

  return (
    <As
      ref={ref}
      title={title}
      aria-label={title}
      className={[
        'inline-flex items-center justify-center rounded-control transition-colors',
        'outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
        'disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
        ICON_BUTTON_SIZES[size],
        TONES[tone] ?? TONES.neutral,
        className,
      ].join(' ')}
      {...props}
    >
      {loading
        ? <Spinner size={size === 'sm' ? 15 : 18} />
        : (children ?? <span className="material-symbols-outlined">{icon}</span>)}
    </As>
  );
});

// A run of related buttons welded into one control — segmented actions like
// pagination arrows, where separate pills would read as unrelated.
export function ButtonGroup({ className = '', children }) {
  return (
    <div
      className={`inline-flex items-center rounded-control border border-paper-500 dark:border-ink-400 overflow-hidden
        [&>*]:rounded-none [&>*]:border-0 [&>*]:focus-visible:ring-inset
        [&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-paper-500 dark:[&>*:not(:last-child)]:border-ink-400
        ${className}`}
    >
      {children}
    </div>
  );
}
