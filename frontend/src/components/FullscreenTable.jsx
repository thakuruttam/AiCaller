import { useRef, useState, useEffect } from 'react';

export function FullscreenButton({ toggle, isFs }) {
  return (
    <button
      onClick={toggle}
      title={isFs ? 'Exit fullscreen' : 'Fullscreen'}
      className="p-1.5 rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-zinc-500 dark:text-slate-400 hover:bg-zinc-50 dark:hover:bg-slate-700 hover:text-zinc-800 dark:hover:text-slate-200 transition-colors"
    >
      <span className="material-symbols-outlined text-[18px]">
        {isFs ? 'fullscreen_exit' : 'fullscreen'}
      </span>
    </button>
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
      className={`${isFs ? 'bg-white dark:bg-[#1e1e2e] overflow-auto flex flex-col' : ''} ${className}`}
    >
      {typeof children === 'function' ? children({ toggle, isFs }) : children}
    </div>
  );
}
