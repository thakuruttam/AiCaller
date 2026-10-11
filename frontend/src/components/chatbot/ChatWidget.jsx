import React, { useState } from 'react';
import ChatLauncher from './ChatLauncher';
import ChatPanel from './ChatPanel';
import { useChat } from './useChat';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const { messages, isLoading, limitInfo, send, clear } = useChat();

  return (
    <>
      <ChatLauncher isOpen={isOpen} onToggle={() => setIsOpen(o => !o)} />
      {isOpen && (
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          limitInfo={limitInfo}
          onSend={send}
          onClear={clear}
        />
      )}
    </>
  );
}
