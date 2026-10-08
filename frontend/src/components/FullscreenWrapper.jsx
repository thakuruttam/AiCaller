import React, { useState } from 'react';
import { Button, IconButton } from '../components/ui';
import { Maximize2, Minimize2 } from 'lucide-react';

export default function FullscreenWrapper({ title, actionNode, children, className = "" }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-paper-100 dark:bg-ink-200 flex flex-col animate-fade-in">
        <div className="border-b border-paper-500 dark:border-ink-400 px-6 py-3.5 flex items-center justify-between bg-paper-100 dark:bg-ink-200 shrink-0">
          <h3 className="font-semibold text-base text-ink-100 dark:text-paper-200 tracking-tight">{title}</h3>
          <div className="flex items-center gap-3">
            {actionNode}
            <IconButton tone="neutral" size="md" title="Exit Fullscreen" onClick={toggleFullscreen}><Minimize2 size={18} /></IconButton>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-paper-200 dark:bg-ink-50 p-5 flex flex-col">
          <div className="bg-card dark:bg-muted rounded-2xl shadow-primary overflow-hidden flex-1 flex flex-col ring-1 ring-black/[0.02] dark:ring-white/[0.05]">
            <div className="overflow-auto flex-1">
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card dark:bg-muted rounded-2xl shadow-primary ring-1 ring-black/[0.02] dark:ring-white/[0.05] overflow-hidden flex flex-col ${className}`}>
      <div className="border-b border-paper-400 dark:border-ink-400/50 px-5 py-3.5 flex items-center justify-between shrink-0 bg-paper-100 dark:bg-ink-200">
        <h3 className="font-semibold text-sm text-ink-100 dark:text-paper-200 tracking-tight">{title}</h3>
        <div className="flex items-center gap-3">
          {actionNode}
          <IconButton tone="neutral" size="md" title="Enter Fullscreen" onClick={toggleFullscreen}><Maximize2 size={15} /></IconButton>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
