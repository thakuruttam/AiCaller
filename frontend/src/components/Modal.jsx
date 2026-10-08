import React, { useEffect, useRef } from 'react';
import { Button, IconButton } from '../components/ui';

// Shared dialog. Kept at this path (and with this prop shape) because several
// screens already import it — the styling, keyboard handling and focus
// behaviour are what changed.
const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

const Modal = ({ isOpen, onClose, title, description, children, footer, size = 'md', className }) => {
  const panelRef = useRef(null);
  const restoreFocusTo = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    restoreFocusTo.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    // Esc closes, and Tab is kept inside the dialog — without this, tabbing
    // walks off into the page behind the backdrop.
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { onClose?.(); return; }
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener('keydown', onKeyDown);
    // Move focus into the dialog so screen readers and keyboards start here.
    const t = setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(t);
      document.body.style.overflow = '';
      restoreFocusTo.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-50/50 backdrop-blur-[2px] animate-backdrop" onClick={onClose} />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex flex-col w-full max-h-[90vh] outline-none
          bg-card dark:bg-muted
          rounded-2xl shadow-overlay animate-scale-in
          ${className || SIZES[size]}`}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border shrink-0">
            <div className="min-w-0">
              {title && <h3 className="text-base font-semibold text-ink-100 dark:text-paper-200">{title}</h3>}
              {description && <p className="text-[13px] text-ink-700 dark:text-ink-800 mt-0.5">{description}</p>}
            </div>
            <IconButton tone="neutral" size="sm" title="Close dialog" icon="close" onClick={onClose} />
          </div>
        )}

        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-paper-200 dark:bg-ink-300/40 rounded-b-2xl shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
