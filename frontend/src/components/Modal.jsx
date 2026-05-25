import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, footer, className }) => {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`relative flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-2xl ring-1 ring-black/[0.08] dark:ring-white/[0.05] border border-white/50 dark:border-slate-700 max-h-[90vh] w-full animate-scale-in ${className || 'max-w-md'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-slate-700 shrink-0">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-slate-100 tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 dark:text-slate-500 hover:bg-zinc-100 dark:hover:bg-slate-700 hover:text-zinc-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-100 dark:border-slate-700 bg-zinc-50/80 dark:bg-slate-800/80 rounded-b-2xl shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
