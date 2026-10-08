import { useState } from 'react';

// Which optional columns a table shows, remembered per browser under
// `storageKey`. Storage can be unavailable (private mode, blocked site data),
// so every read and write is guarded and the defaults always render.
export function useColumnVisibility(storageKey, columns) {
  const [hidden, setHidden] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const toggle = (key) => setHidden((prev) => {
    const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* not persisted */ }
    return next;
  });

  return {
    columns: columns.map((c) => ({ ...c, visible: !hidden.includes(c.key) })),
    isVisible: (key) => !hidden.includes(key),
    toggle,
    visibleCount: columns.filter((c) => !hidden.includes(c.key)).length,
  };
}
