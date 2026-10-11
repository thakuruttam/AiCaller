import { useState } from 'react';
import api from '../../api/axios';

// Ephemeral, per-tab chat state — not persisted. The server re-truncates
// whatever history we send regardless, so there's no correctness reason to
// keep more than a short window client-side either.
const MAX_HISTORY_SENT = 8;

let nextId = 1;

export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [limitInfo, setLimitInfo] = useState(null); // { code, error } while a limit is active

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage = { id: nextId++, role: 'user', content: trimmed };
    const history = messages.slice(-MAX_HISTORY_SENT).map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setLimitInfo(null);

    try {
      const { data } = await api.post('/api/chatbot/message', { message: trimmed, history });
      setMessages(prev => [...prev, { id: nextId++, role: 'assistant', content: data.reply }]);
    } catch (err) {
      const code = err.response?.data?.code;
      const errorText = err.response?.data?.error || "Something went wrong — try again.";
      if (code === 'RATE_LIMIT_USER_HOUR' || code === 'RATE_LIMIT_USER_DAY' || code === 'RATE_LIMIT_WORKSPACE_DAY' || code === 'CHATBOT_UNAVAILABLE') {
        setLimitInfo({ code, error: errorText });
      } else {
        setMessages(prev => [...prev, { id: nextId++, role: 'assistant', content: errorText, isError: true }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clear = () => {
    setMessages([]);
    setLimitInfo(null);
  };

  return { messages, isLoading, limitInfo, send, clear };
}
