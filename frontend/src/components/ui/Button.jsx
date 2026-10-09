import React from 'react';
import Spinner from '../Spinner';

// Every button in the app comes from here. A variant carries the whole visual
// contract — fill, hairline, hover, disabled and focus ring — so no screen has
// to restate it, and so the focus ring can never be forgotten.
// Flat, solid fills — no gradients. Every variant pairs a resting colour with
// one hover and one pressed step from the same ramp, so the button visibly
// responds without changing hue.
const VARIANTS = {
  // Brand blue. One per view, on the primary action.
  primary:
    'bg-brand-500 text-white shadow-xs hover:bg-brand-600 active:bg-brand-700 ' +
    'disabled:bg-paper-500 disabled:text-ink-800 disabled:shadow-none ' +
    'dark:disabled:bg-ink-400 dark:disabled:text-ink-700',
  // Bordered surface on the card colour. The default for everything that
  // isn't the main action. In dark mode it sits one step above the card
  // (white/5 over bg-muted) so it never vanishes into the surface it's on.
  secondary:
    'bg-card dark:bg-white/[0.05] text-foreground border border-border shadow-xs ' +
    'hover:bg-paper-200 dark:hover:bg-white/[0.09] active:bg-paper-300 dark:active:bg-white/[0.12] ' +
    'disabled:text-ink-800 dark:disabled:text-ink-700 disabled:shadow-none',
  // Tinted, no border — for accent actions that shouldn't compete with primary.
  subtle:
    'bg-brand-500/10 text-brand-600 dark:text-brand-300 hover:bg-brand-500/15 active:bg-brand-500/20 dark:hover:bg-brand-500/20',
  // No chrome until hovered. Toolbars, table rows, dismissals.
  ghost:
    'text-muted-foreground hover:bg-paper-300/70 dark:hover:bg-white/[0.06] hover:text-foreground active:bg-paper-400/70',
  // Destructive confirmation (delete, kill, revoke). Solid red so "delete"
  // is never mistaken for "cancel" in a dialog footer.
  danger:
    'bg-negative-strong text-white shadow-xs hover:bg-negative-stronger active:bg-negative-stronger ' +
    'disabled:bg-paper-500 disabled:text-ink-800 disabled:shadow-none',
  // Affirmative, non-primary outcomes (approve, resolve, mark done).
  success:
    'bg-positive-strong text-white shadow-xs hover:bg-positive-stronger active:bg-positive-stronger ' +
    'disabled:bg-paper-500 disabled:text-ink-800 disabled:shadow-none',
  // Destructive but quiet until hovered, so it isn't the loudest thing on
  // screen just because it's dangerous.
  dangerGhost:
    'text-muted-foreground hover:bg-negative/10 hover:text-negative-strong',
  // Reads as a link, behaves as a button.
  link:
    'text-brand-500 dark:text-brand-450 hover:text-brand-600 hover:underline underline-offset-[3px] !px-0 !h-auto',
};

// One height scale shared with Input/Select (CONTROL_HEIGHT in Input.jsx), so
// a button next to a field lines up without per-screen nudging.
const SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1 rounded-field',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-control',
  md: 'h-9 px-4 text-sm gap-2 rounded-control',
  lg: 'h-10 px-5 text-sm gap-2 rounded-control',
};

const ICON_SIZE = { xs: 14, sm: 15, md: 16, lg: 18 };

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
        'inline-flex items-center justify-center font-semibold whitespace-nowrap',
        'transition-[color,background-color,border-color,filter,transform] duration-150 outline-none cursor-pointer select-none',
        'focus-visible:ring-[3px] focus-visible:ring-brand-500/30',
        'disabled:cursor-not-allowed disabled:opacity-100 enabled:active:scale-[0.98]',
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
// Square, and the same heights as Button's sm/md/lg so icon and text buttons
// in one toolbar sit on a single line.
const ICON_BUTTON_SIZES = {
  sm: 'size-8 [--icon-size:16px] [&_svg]:size-4',
  md: 'size-9 [--icon-size:18px] [&_svg]:size-[18px]',
  lg: 'size-10 [--icon-size:20px] [&_svg]:size-5',
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
    neutral: 'text-muted-foreground hover:bg-paper-300/70 dark:hover:bg-white/[0.06] hover:text-foreground',
    brand:   'text-brand-500 dark:text-brand-300 hover:bg-brand-500/10',
    danger:  'text-muted-foreground hover:bg-negative/10 hover:text-negative-dim',
  };

  return (
    <As
      ref={ref}
      title={title}
      aria-label={title}
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-control transition-colors',
        'outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent cursor-pointer',
        'aria-expanded:bg-paper-300/70 dark:aria-expanded:bg-white/[0.06] aria-expanded:text-foreground',
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
      className={`inline-flex items-center rounded-control border border-border shadow-xs overflow-hidden
        [&>*]:rounded-none [&>*]:border-0 [&>*]:shadow-none [&>*]:focus-visible:ring-inset
        [&>*:not(:last-child)]:border-r [&>*:not(:last-child)]:border-border
        ${className}`}
    >
      {children}
    </div>
  );
}
