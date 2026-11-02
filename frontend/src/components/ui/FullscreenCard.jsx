import React from 'react';
import Modal from '../Modal';

// Wraps a table's card so the page's existing TableToolbar/Table/Pagination
// tree becomes its own fullscreen view too — rendered inside the shared
// Modal (large, not literal OS fullscreen) instead of inline on the page.
// Modal is the one sanctioned `fixed inset-0` surface in the app (see
// test/designSystem.test.js's "opens dialogs through the shared Modal"
// rule), so this is how every "view in fullscreen" table gets there rather
// than each page hand-rolling its own overlay.
export default function FullscreenCard({ isFullscreen, onClose, className = '', children }) {
  if (isFullscreen) {
    // Modal's own content wrapper is the scroll container (overflow-y-auto
    // flex-1) — this div must NOT be forced to h-full, or its own
    // overflow-hidden (most callers' className) clips content taller than
    // the modal instead of letting that wrapper scroll it.
    return (
      <Modal isOpen onClose={onClose} fullscreen>
        <div className={className}>{children}</div>
      </Modal>
    );
  }
  return <div className={className}>{children}</div>;
}
