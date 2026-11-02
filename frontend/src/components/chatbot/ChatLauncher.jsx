import React from 'react';

// Scoped `fixed bottom-5 right-5` positioning — not `fixed inset-0`, which
// the design-system test confines to Modal.jsx only.
export default function ChatLauncher({ isOpen, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={isOpen ? 'Close assistant' : 'Ask the assistant'}
      aria-label={isOpen ? 'Close assistant' : 'Ask the assistant'}
      aria-expanded={isOpen}
      className="fixed bottom-5 right-5 z-[140] flex size-12 items-center justify-center rounded-full
        bg-brand-500 text-white shadow-overlay hover:bg-brand-600 active:bg-brand-700
        outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/40 transition-colors cursor-pointer"
    >
      <span className="material-symbols-outlined [--icon-size:24px]">{isOpen ? 'close' : 'chat'}</span>
    </button>
  );
}
