import React, { useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { Alert, Button, Card, Textarea } from '../../components/ui';
import { END_REASON_LABELS, TEST_NAME, testGreeting } from './campaignModel';

function Bubble({ from, children }) {
  const agent = from === 'assistant';
  return (
    <li className={`flex ${agent ? 'justify-start' : 'justify-end'}`}>
      <p className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug whitespace-pre-wrap
        ${agent ? 'bg-paper-400 dark:bg-white/10 text-foreground rounded-bl-sm' : 'bg-brand-500 text-white rounded-br-sm'}`}>
        {children}
      </p>
    </li>
  );
}

/**
 * Type as the caller and see how the agent handles it — same instructions
 * and end-of-call rules as a real call (POST /api/campaigns/try-chat), on
 * whatever is in the builder right now, saved or not.
 */
export default function TryItPanel({ payload, className = '' }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [ended, setEnded] = useState(null); // { reason, closingLine }
  const [captured, setCaptured] = useState({}); // details saved so far, as a real call would
  const listRef = useRef(null);
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);
  useEffect(() => { listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight }); }, [messages, ended, sending]);

  const reset = () => { setMessages([]); setEnded(null); setCaptured({}); setError(null); setInput(''); };

  const send = async () => {
    const text = input.trim();
    if (!text || sending || ended) return;
    const next = [...messages, { role: 'user', text }];
    setMessages(next);
    setInput('');
    setSending(true);
    setError(null);
    try {
      const { data } = await api.post('/api/campaigns/try-chat', {
        payload: {
          goals: payload.goals,
          conversation: payload.conversation,
          endCallIf: payload.endCallIf,
          callSettings: payload.callSettings,
        },
        contactName: TEST_NAME,
        messages: next,
      });
      if (!live.current) return;
      if (data.reply) setMessages([...next, { role: 'assistant', text: data.reply }]);
      if (data.captured && Object.keys(data.captured).length) setCaptured(c => ({ ...c, ...data.captured }));
      if (data.endCall) setEnded(data.endCall);
    } catch (err) {
      if (!live.current) return;
      const code = err.response?.data?.code;
      setError(code === 'TRY_CHAT_UNAVAILABLE'
        ? "Test chats aren't switched on for this server yet."
        : err.response?.data?.error || 'The test agent did not answer. Try again.');
      // Put the message back so it can be resent.
      setMessages(messages);
      setInput(text);
    } finally {
      if (live.current) setSending(false);
    }
  };

  return (
    <Card className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Try it</h2>
        {(messages.length > 0 || ended) && (
          <Button variant="link" size="sm" onClick={reset} disabled={sending}>Start again</Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        Type as the person you're calling. Same instructions as a real call — not charged.
      </p>

      <ol ref={listRef} aria-label="Test conversation" aria-live="polite" className="flex flex-col gap-2 max-h-[340px] min-h-[120px] overflow-y-auto pr-1">
        <Bubble from="assistant">{testGreeting(payload.goals?.callIntro)}</Bubble>
        {messages.map((m, i) => <Bubble key={i} from={m.role}>{m.text}</Bubble>)}
        {sending && (
          <li className="text-xs text-muted-foreground px-1" aria-label="Agent is replying">…</li>
        )}
        {ended && (
          <>
            <Bubble from="assistant">{ended.closingLine}</Bubble>
            <li className="flex items-center justify-center gap-1.5 pt-1 text-xs font-medium text-muted-foreground">
              <span className="material-symbols-outlined [--icon-size:15px]">call_end</span>
              Call ended · {END_REASON_LABELS[ended.reason] || ended.reason}
            </li>
          </>
        )}
      </ol>

      {Object.keys(captured).length > 0 && (
        <div className="rounded-xl bg-brand-500/10 border border-brand-500/25 px-3 py-2">
          <p className="text-xs font-medium text-foreground mb-1">Saved with this call</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs" aria-label="Details saved with this call">
            {Object.entries(captured).map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-foreground break-words">{v}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      )}

      {error && <Alert tone="negative" title={error} />}

      <div className="flex items-end gap-2">
        <Textarea
          aria-label="Your reply as the caller"
          rows={2}
          value={input}
          disabled={!!ended}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={ended ? 'The call has ended — start again to retry.' : messages.length ? 'Your reply…' : 'e.g. Yes, speaking. What is this about?'}
        />
        <Button onClick={send} loading={sending} disabled={!input.trim() || !!ended} icon="send" aria-label="Send">
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </Card>
  );
}
