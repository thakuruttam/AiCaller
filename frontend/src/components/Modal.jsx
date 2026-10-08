import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconButton } from '../components/ui';
import { usePortalContainer } from '../pages/web3-dashboard/ui/portal-container';

// Shared dialog. Kept at this path (and with this prop shape) because several
// screens already import it.
//
// Rendered through a portal so no ancestor's overflow or transform (page
// fade-in animations, scroll containers) can clip or mis-position it. The
// portal lands in the themed portal container when there is one; otherwise
// in <body> wrapped in its own .web3-dashboard scope, so the surface tokens
// (bg-card, border-border, …) resolve either way.
//
// Below `sm` it opens as a bottom sheet — a centred box on a phone leaves the
// primary action out of thumb reach and wastes the screen's width.
const SIZES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
  '2xl': 'sm:max-w-5xl',
};

const TONES = {
  danger:  { icon: 'warning', chip: 'bg-negative/10 text-negative-dim dark:text-negative' },
  caution: { icon: 'error', chip: 'bg-caution/10 text-caution-dim dark:text-caution' },
  info:    { icon: 'info', chip: 'bg-brand-500/10 text-brand-600 dark:text-brand-300' },
  success: { icon: 'check_circle', chip: 'bg-positive/10 text-positive-dim dark:text-positive' },
};

// Open dialogs, innermost last — only the top one answers Esc and traps Tab,
// so a confirm opened over a form closes alone. The body's own overflow and
// padding are captured when the first dialog opens and restored when the
// last one closes, whatever order they close in.
const stack = [];
let savedBodyStyle = null;

const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  tone,
  icon,
  dismissible = true,
  className,
}) => {
  const panelRef = useRef(null);
  const restoreFocusTo = useRef(null);
  const container = usePortalContainer();
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const token = {};
    restoreFocusTo.current = document.activeElement;

    // Lock page scroll, padding by the scrollbar's width so the page behind
    // doesn't jump sideways when it disappears.
    if (!stack.length) {
      savedBodyStyle = { overflow: document.body.style.overflow, paddingRight: document.body.style.paddingRight };
      const gap = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    }
    stack.push(token);

    const onKeyDown = (e) => {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        if (dismissible) { e.stopPropagation(); onClose?.(); }
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKeyDown);
    // Focus the first field if there is one (forms), else the dialog itself
    // so screen readers announce it.
    const t = setTimeout(() => {
      const field = panelRef.current?.querySelector('[autofocus], input:not([type=hidden]):not([disabled]), textarea, select');
      (field || panelRef.current)?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(t);
      stack.splice(stack.indexOf(token), 1);
      if (!stack.length && savedBodyStyle) {
        document.body.style.overflow = savedBodyStyle.overflow;
        document.body.style.paddingRight = savedBodyStyle.paddingRight;
        savedBodyStyle = null;
      }
      restoreFocusTo.current?.focus?.();
    };
  }, [isOpen, onClose, dismissible]);

  if (!isOpen) return null;

  const toneMeta = tone ? TONES[tone] : null;
  const headerIcon = icon ?? toneMeta?.icon;

  const dialog = (
    <div className="fixed inset-0 z-[150] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-ink-50/40 backdrop-blur-[3px] animate-backdrop"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role={tone === 'danger' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`relative flex flex-col w-full max-h-[92vh] sm:max-h-[88vh] outline-none
          bg-card dark:bg-muted text-foreground shadow-overlay ring-1 ring-black/5 dark:ring-white/10
          rounded-t-2xl sm:rounded-2xl animate-scale-in
          ${className || SIZES[size] || SIZES.md}`}
      >
        {/* Grab handle — signals the bottom sheet on phones. */}
        <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-paper-600 dark:bg-white/15" aria-hidden="true" />

        {(title || description) && (
          <div className="flex items-start gap-3 px-6 pt-5 pb-4 shrink-0">
            {headerIcon && (
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${toneMeta?.chip ?? 'bg-paper-300 dark:bg-white/[0.06] text-muted-foreground'}`}>
                <span className="material-symbols-outlined [--icon-size:20px]">{headerIcon}</span>
              </span>
            )}
            <div className="min-w-0 flex-1 pt-0.5">
              {title && <h2 id={titleId} className="text-base font-semibold leading-6 text-foreground">{title}</h2>}
              {description && <p id={descId} className="text-sm text-muted-foreground mt-1">{description}</p>}
            </div>
            {dismissible && (
              <IconButton tone="neutral" size="sm" title="Close dialog" icon="close" onClick={onClose} className="-mr-2 -mt-1" />
            )}
          </div>
        )}

        {children != null && children !== false && (
          <div className={`px-6 overflow-y-auto flex-1 ${title || description ? 'pb-5' : 'py-5'}`}>{children}</div>
        )}

        {footer && (
          <div className="flex flex-col-reverse gap-2 px-6 py-4 border-t border-border mt-auto bg-paper-200/60 dark:bg-white/[0.02] rounded-b-2xl shrink-0 sm:flex-row sm:items-center sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(
    container ? dialog : <div className="web3-dashboard">{dialog}</div>,
    container || document.body,
  );
};

export default Modal;
