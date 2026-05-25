import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Mic, MicOff, Volume2, Loader2, Play } from 'lucide-react';

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
            <div className="text-sm font-medium text-red-600 p-3 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div className="bg-zinc-50 dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-xl p-4 min-h-[200px] max-h-[300px] overflow-y-auto flex flex-col gap-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-slate-500 mb-1">
                  {m.role === 'user' ? 'You (Microphone)' : 'AI Voice Agent'}
                </span>
                <div className={`p-3 rounded-xl text-sm max-w-[80%] ${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 text-zinc-900 dark:text-slate-100 shadow-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && !isListening && (
              <div className="flex items-center gap-2 text-zinc-400 dark:text-slate-500 text-sm">
                <Loader2 size={14} className="animate-spin" /> Thinking...
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              onMouseDown={toggleListen}
              disabled={loading && !isListening}
              className={`h-16 w-16 rounded-full flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-red-600 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 shadow-md'
              }`}
            >
              {isListening ? <Mic size={28} /> : <MicOff size={24} />}
            </button>
            <p className="text-xs text-zinc-400 dark:text-slate-500">Click to talk, click to stop.</p>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => { setSession(null); window.speechSynthesis.cancel(); recognitionRef.current?.stop(); }}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shadow-sm"
            >
              End Session
            </button>
          </div>
        </div>
      ) : (
        <div className="p-8 flex flex-col items-center justify-center text-center gap-5">
          {error && (
            <div className="text-sm font-medium text-red-600 p-3 bg-red-50 border border-red-200 rounded-lg w-full">
              {error}
            </div>
          )}
          <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
            <Volume2 size={28} className="text-indigo-600" />
          </div>
          <div className="max-w-sm">
            <p className="text-sm text-zinc-600 dark:text-slate-400 leading-relaxed mb-4">
              Use this sandbox to talk directly to your LLM configuration for this campaign before deploying to real phone numbers.
            </p>
            <button
              onClick={startSession}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold h-10 px-5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
              {loading ? 'Starting...' : 'Start Sandbox'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
