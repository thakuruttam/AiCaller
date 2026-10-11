import { useState } from 'react';

// A table's "fullscreen" view is just the same card rendered inside the
// shared Modal at a large size, rather than inline on the page — see
// FullscreenCard in components/ui. Kept as its own hook (rather than inline
// useState at each call site) so every table page toggles the same way.
export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggle = () => setIsFullscreen((v) => !v);
  return { isFullscreen, toggle };
}
