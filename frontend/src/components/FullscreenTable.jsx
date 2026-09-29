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

  useEffect(() => {
    const handler = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggle = () => {
    if (!document.fullscreenElement) ref.current?.requestFullscreen();
    else document.exitFullscreen();
  };

  return (
    <div
      ref={ref}
      className={`${isFs ? 'bg-paper-100 dark:bg-ink-200 overflow-auto flex flex-col' : ''} ${className}`}
    >
      {typeof children === 'function' ? children({ toggle, isFs }) : children}
    </div>
  );
}
