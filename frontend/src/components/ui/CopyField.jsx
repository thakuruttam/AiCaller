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
        <label className="block text-xs font-medium text-ink-700 dark:text-ink-800 mb-1.5">{label}</label>
      )}
      <div className="flex items-center gap-2 p-3 rounded-card border border-paper-500 dark:border-ink-400 bg-paper-200 dark:bg-ink-50">
        <span className="text-xs text-ink-600 dark:text-ink-900 flex-1 break-all font-mono">{value}</span>
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
