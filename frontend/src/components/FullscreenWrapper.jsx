import React, { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

export default function FullscreenWrapper({ title, actionNode, children, className = "" }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-slate-800 flex flex-col animate-fade-in">
        <div className="border-b border-zinc-200 dark:border-slate-700 px-6 py-3.5 flex items-center justify-between bg-white dark:bg-slate-800 shrink-0">
          <h3 className="font-semibold text-base text-zinc-900 dark:text-slate-100 tracking-tight">{title}</h3>
          <div className="flex items-center gap-3">
            {actionNode}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-slate-700 rounded-lg text-zinc-400 dark:text-slate-500 hover:text-zinc-700 dark:hover:text-slate-300 transition-colors"
              title="Exit Fullscreen"
            >
              <Minimize2 size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-zinc-50 dark:bg-slate-900 p-5 flex flex-col">
          <div className="border border-zinc-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden flex-1 flex flex-col bg-white dark:bg-slate-800 ring-1 ring-black/[0.02] dark:ring-white/[0.05]">
            <div className="overflow-auto flex-1">
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-zinc-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.05] overflow-hidden flex flex-col ${className}`}>
      <div className="border-b border-zinc-100 dark:border-slate-700/50 px-5 py-3.5 flex items-center justify-between shrink-0 bg-white dark:bg-slate-800">
        <h3 className="font-semibold text-sm text-zinc-900 dark:text-slate-100 tracking-tight">{title}</h3>
        <div className="flex items-center gap-3">
          {actionNode}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-zinc-100 dark:hover:bg-slate-700 rounded-lg text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-300 transition-colors"
            title="Enter Fullscreen"
          >
            <Maximize2 size={15} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
