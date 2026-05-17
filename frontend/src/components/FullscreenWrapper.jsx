import React, { useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

export default function FullscreenWrapper({ title, actionNode, children, className = "" }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col animate-fade-in p-0 m-0">
        <div className="border-b px-6 py-4 flex items-center justify-between bg-card shrink-0">
          <h3 className="font-semibold text-xl m-0">{title}</h3>
          <div className="flex items-center gap-4">
            {actionNode}
            <button 
              onClick={toggleFullscreen} 
              className="p-2 hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground transition-colors"
              title="Exit Fullscreen"
            >
              <Minimize2 size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-muted/20 p-6 flex flex-col">
          <div className="border rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col bg-card">
            <div className="overflow-auto flex-1">
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Normal mode
  return (
    <div className={`rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col ${className}`}>
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <h3 className="font-semibold text-lg m-0">{title}</h3>
        <div className="flex items-center gap-4">
          {actionNode}
          <button 
            onClick={toggleFullscreen} 
            className="p-1.5 hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground transition-colors"
            title="Enter Fullscreen"
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  );
}
