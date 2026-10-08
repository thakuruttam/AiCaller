import { useRef, useState, useEffect } from 'react';
import { Button, IconButton } from '../components/ui';

export function FullscreenButton({ toggle, isFs }) {
  return (
    <IconButton tone="neutral" size="md" title={isFs ? 'Exit fullscreen' : 'Fullscreen'} icon={isFs ? 'fullscreen_exit' : 'fullscreen'} onClick={toggle} />
  );
}

export default function FullscreenTable({ children, className = '' }) {
  const ref = useRef(null);
  const [isFs, setIsFs] = useState(false);
  // Whether the current fullscreen is the real browser API vs. our CSS
  // overlay fallback (see toggle() below) — only the native case should
  // react to the browser's own fullscreenchange/Escape handling.
  const [usingNative, setUsingNative] = useState(false);

  useEffect(() => {
    const handler = () => {
      if (usingNative && !document.fullscreenElement) setIsFs(false);
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, [usingNative]);

  const toggle = async () => {
    if (!isFs) {
      try {
        await ref.current?.requestFullscreen();
        setUsingNative(true);
      } catch {
        // Fullscreen API request rejected — e.g. "not granted" when the
        // page's Permissions-Policy or an embedding context disallows it.
        // Fall back to a CSS overlay that still fills the viewport instead
        // of the button silently doing nothing.
        setUsingNative(false);
      }
      setIsFs(true);
    } else {
      if (usingNative && document.fullscreenElement) {
        await document.exitFullscreen();
      }
      setUsingNative(false);
      setIsFs(false);
    }
  };

  return (
    <div
      ref={ref}
      className={`${isFs ? 'bg-card dark:bg-muted overflow-auto flex flex-col' : ''} ${isFs && !usingNative ? 'fixed inset-0 z-50' : ''} ${className}`}
    >
      {typeof children === 'function' ? children({ toggle, isFs }) : children}
    </div>
  );
}
