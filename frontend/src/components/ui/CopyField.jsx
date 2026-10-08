import React, { useEffect, useRef, useState } from 'react';
import { IconButton } from './Button';

// A read-only value with a copy affordance — share links, API keys, invite
// URLs. Owns its own "copied" feedback so callers don't each reimplement the
// timeout, and the icon swap doubles as the confirmation.
export default function CopyField({ value, label, className = '', onCopy }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      onCopy?.();
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the value stays selectable, so leave it be */
    }
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-[13px] font-medium text-foreground mb-1.5">{label}</label>
      )}
      <div className="flex items-center gap-2 py-1.5 pl-3 pr-1.5 rounded-control border border-border bg-paper-200/70 dark:bg-white/[0.03]">
        <span className="text-xs text-muted-foreground flex-1 break-all font-mono">{value}</span>
        <IconButton
          size="sm"
          tone={copied ? 'brand' : 'neutral'}
          title={copied ? 'Copied' : 'Copy to clipboard'}
          icon={copied ? 'check' : 'content_copy'}
          onClick={copy}
          className="shrink-0"
        />
      </div>
      {/* Announced politely so a screen reader confirms the copy without
          stealing focus from wherever the user is. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </div>
  );
}
