import React from 'react';

export default function ChatMessage({ role, content, isError }) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words
          ${isUser
            ? 'bg-brand-500 text-white'
            : isError
              ? 'bg-negative/10 text-negative-strong'
              : 'bg-paper-200 dark:bg-white/[0.06] text-foreground'}`}
      >
        {content}
      </div>
    </div>
  );
}
