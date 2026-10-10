import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Mic, MicOff, Volume2, Play } from 'lucide-react';
import { Button, IconButton, WaveLoader } from '../../../components/ui';

export default function SandboxAgent({ campaign }) {
  const [session, setSession] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = async (event) => {
        const text = event.results[0][0].transcript;
        setIsListening(false);
        addMessage('user', text);
        await sendToNodeAgent(text);
      };

      recognitionRef.current.onerror = (event) => {
        if (event.error !== 'aborted') setError(`Microphone error: ${event.error}`);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => { setIsListening(false); };
    } else {
      setError("Your browser does not support Web Speech API. Please use Chrome.");
    }

    return () => { if (recognitionRef.current) recognitionRef.current.abort(); };
  }, [session]);

  const addMessage = (role, text) => {
    setMessages(prev => [...prev, { role, text }]);
  };

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha") || v.lang === "en-US");
    if (voice) msg.voice = voice;
    msg.pitch = 1.0;
    msg.rate = 0.95;
    window.speechSynthesis.speak(msg);
  };

  const startSession = async () => {
    setLoading(true);
    setError(null);
    setMessages([]);
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await axios.post(`${baseURL}/api/sandbox/start`, {
        campaignId: campaign.id,
        contactName: 'Sandbox Tester'
      });
      setSession(res.data.sessionId);
      addMessage('assistant', res.data.reply);
      speakText(res.data.reply);
    } catch (err) {
      console.error(err);
      setError("Cannot connect to Node Voice Coordinator. Ensure backend is running and Ollama is started.");
    }
    setLoading(false);
  };

  const sendToNodeAgent = async (text) => {
    if (!session) return;
    setLoading(true);
    try {
      const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await axios.post(`${baseURL}/api/sandbox/chat`, {
        sessionId: session,
        message: text
      });
      addMessage('assistant', res.data.reply);
      speakText(res.data.reply);
    } catch (err) {
      console.error(err);
      setError("Error communicating with AI.");
    }
    setLoading(false);
  };

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      window.speechSynthesis.cancel();
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  return (
    <div className="flex flex-col gap-0">
      {session ? (
        <div className="p-6 flex flex-col gap-5">
          {error && (
            <div className="text-sm font-medium text-negative-dim p-3 bg-negative/10 border border-negative/25 rounded-control">
              {error}
            </div>
          )}

          <div className="bg-paper-200 dark:bg-ink-50 border border-paper-500 dark:border-ink-400 rounded-card p-4 min-h-[200px] max-h-[300px] overflow-y-auto flex flex-col gap-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <span className="text-xs uppercase font-medium text-muted-foreground mb-1">
                  {m.role === 'user' ? 'You (Microphone)' : 'AI Voice Agent'}
                </span>
                <div className={`p-3 rounded-xl text-sm max-w-[80%] ${m.role === 'user' ? 'bg-brand-500 text-white rounded-tr-sm' : 'bg-paper-200 dark:bg-white/[0.04] border border-border text-foreground rounded-tl-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && !isListening && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <WaveLoader size="xs" className="text-brand-500" label="Thinking" /> Thinking…
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-3">
            <Button variant="danger" size="md" onMouseDown={toggleListen} disabled={loading && !isListening}>
              {isListening ? <Mic size={28} /> : <MicOff size={24} />}
            </Button>
            <p className="text-xs font-medium text-muted-foreground">Click to talk, click to stop.</p>
          </div>

          <div className="flex justify-end">
            <Button variant="dangerGhost" size="sm" onClick={() => { setSession(null); window.speechSynthesis.cancel(); recognitionRef.current?.stop(); }}>End Session</Button>
          </div>
        </div>
      ) : (
        <div className="p-8 flex flex-col items-center justify-center text-center gap-5">
          {error && (
            <div className="text-sm font-medium text-negative-dim p-3 bg-negative/10 border border-negative/25 rounded-control w-full">
              {error}
            </div>
          )}
          <div className="h-16 w-16 bg-brand-500/10 rounded-card flex items-center justify-center">
            <Volume2 size={28} className="text-brand-500" />
          </div>
          <div className="max-w-sm">
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Use this sandbox to talk directly to your LLM configuration for this campaign before deploying to real phone numbers.
            </p>
            <Button variant="primary" size="md" onClick={startSession} loading={loading}>
              {!loading && <Play size={16} />}
              {loading ? 'Starting…' : 'Start Sandbox'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
