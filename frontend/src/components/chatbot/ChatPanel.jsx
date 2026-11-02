import React, { useEffect, useRef, useState } from 'react';
import { IconButton } from '../ui';
import ChatMessage from './ChatMessage';
import { useConfirm } from '../../context/ConfirmContext';

const LIMIT_COPY = {
  RATE_LIMIT_USER_HOUR: { title: "You've hit the hourly limit", tone: 'caution' },
  RATE_LIMIT_USER_DAY: { title: "You've hit today's limit", tone: 'caution' },
  RATE_LIMIT_WORKSPACE_DAY: { title: "Your workspace has hit today's limit", tone: 'negative' },
  CHATBOT_UNAVAILABLE: { title: 'Assistant unavailable', tone: 'negative' },
};

export default function ChatPanel({ messages, isLoading, limitInfo, onSend, onClear }) {
  const [input, setInput] = useState('');
  const listRef = useRef(null);
  const confirm = useConfirm();

  useEffect(() => {
    const el = listRef.current;
    if (typeof el?.scrollTo === 'function') el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  const disabled = isLoading || !!limitInfo;

  const submit = () => {
    if (disabled || !input.trim()) return;
    onSend(input);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleClear = async () => {
    if (messages.length === 0) return;
    const ok = await confirm({
      title: 'Clear this conversation?',
      body: 'This only clears what you see here — it does not change your question limits.',
      confirmLabel: 'Clear',
      tone: 'danger',
    });
    if (ok) onClear();
  };

  return (
    <div
      role="dialog"
      aria-label="AI Caller Pro assistant"
      className="fixed bottom-20 right-5 z-[140] flex h-[32rem] w-96 max-w-[calc(100vw-2.5rem)] flex-col
        rounded-2xl border border-border bg-card dark:bg-muted shadow-overlay animate-scale-in overflow-hidden"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined [--icon-size:20px] text-brand-500">smart_toy</span>
          <p className="text-sm font-semibold text-foreground truncate">Assistant</p>
        </div>
        <IconButton title="Clear conversation" icon="delete_sweep" size="sm" onClick={handleClear} disabled={messages.length === 0} />
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground py-6 text-center">
            Ask me how to use AI Caller Pro, or about your workspace's campaigns, usage, or billing.
          </p>
        )}
        {messages.map(m => (
          <ChatMessage key={m.id} role={m.role} content={m.content} isError={m.isError} />
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-paper-200 dark:bg-white/[0.06] px-3 py-2">
              <span className="flex gap-1">
                <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
                <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
                <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
              </span>
            </div>
          </div>
        )}
      </div>

      {limitInfo && (
        <div
          className={`mx-4 mb-3 shrink-0 rounded-control px-3 py-2 text-xs
            ${LIMIT_COPY[limitInfo.code]?.tone === 'negative'
              ? 'bg-negative/10 text-negative-strong'
              : 'bg-caution/10 text-caution-dim'}`}
        >
          <p className="font-semibold">{LIMIT_COPY[limitInfo.code]?.title || 'Limit reached'}</p>
          <p className="mt-0.5">{limitInfo.error}</p>
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-border p-3 shrink-0">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={limitInfo ? 'Limit reached' : 'Ask a question…'}
          aria-label="Message"
          className="flex-1 resize-none rounded-control border border-border bg-paper-200 dark:bg-white/[0.04]
            px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80 outline-none
            focus:ring-[3px] focus:ring-brand-500/20 focus:border-brand-450 disabled:opacity-50"
        />
        <IconButton title="Send" icon="send" tone="brand" onClick={submit} disabled={disabled || !input.trim()} />
      </div>
    </div>
  );
}
