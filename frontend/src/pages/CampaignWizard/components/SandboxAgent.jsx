import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Mic, MicOff, Settings, Volume2, Loader2, Play } from 'lucide-react';

export default function SandboxAgent({ campaign }) {
  const [session, setSession] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);

  useEffect(() => {
    // Setup Browser Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = async (event) => {
        const text = event.results[0][0].transcript;
        console.log("Heard:", text);
        setIsListening(false);
        addMessage('user', text);
        await sendToNodeAgent(text);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        if(event.error !== 'aborted') {
            setError(`Microphone error: ${event.error}`);
        }
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
         setIsListening(false);
      }
    } else {
      setError("Your browser does not support Web Speech API. Please use Chrome.");
    }
    
    return () => {
       if (recognitionRef.current) recognitionRef.current.abort();
    }
  }, [session]);

  const addMessage = (role, text) => {
    setMessages(prev => [...prev, { role, text }]);
  };

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    
    // Stop any current bleeding audio
    window.speechSynthesis.cancel();
    
    const msg = new SpeechSynthesisUtterance(text);
    // Grab a pleasant voice if available
    const voices = window.speechSynthesis.getVoices();
    // Prefer Google US English or any English Female voice to keep it natural
    const voice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Samantha") || v.lang === "en-US");
    if (voice) msg.voice = voice;
    
    msg.pitch = 1.0; 
    msg.rate = 0.95; // Slightly slower for better clarity
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
      window.speechSynthesis.cancel(); // Interrupt AI if speaking
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden mt-6">
      <div className="border-b px-6 py-4 flex justify-between items-center bg-muted/20">
        <div className="flex flex-col">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Volume2 size={18} className="text-primary"/> UI Sandbox: Live AI Test
          </h3>
          <p className="text-xs text-muted-foreground">Uses Mac Browser native STT/TTS connected to local Llama 3</p>
        </div>
        {!session ? (
          <button 
             onClick={startSession}
             disabled={loading}
             className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90">
             {loading ? <Loader2 className="animate-spin mr-2" size={16}/> : <Play className="mr-2" size={16}/>}
             Start Sandbox
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-secondary px-2 rounded">{session}</span>
            <button 
               onClick={() => { setSession(null); window.speechSynthesis.cancel(); recognitionRef.current?.stop(); }}
               className="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground text-destructive">
               End Test
            </button>
          </div>
        )}
      </div>

      <div className="p-6">
        {error && <div className="text-sm font-medium text-destructive mb-4 p-3 bg-destructive/10 rounded-md">{error}</div>}
        
        {session ? (
           <div className="flex flex-col gap-6">
              <div className="flex-1 bg-muted/20 border rounded-lg p-4 min-h-[200px] max-h-[300px] overflow-y-auto flex flex-col gap-3">
                 {messages.map((m, i) => (
                    <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                       <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">{m.role === 'user' ? 'You (Microphone)' : 'Llama 3 Voice Agent'}</span>
                       <div className={`p-3 rounded-lg text-sm max-w-[80%] ${m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted border text-foreground'}`}>
                          {m.text}
                       </div>
                    </div>
                 ))}
                 {loading && !isListening && (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                       <Loader2 size={14} className="animate-spin" /> API thinking...
                    </div>
                 )}
              </div>
              
              <div className="flex justify-center">
                 <button 
                   onMouseDown={toggleListen}
                   disabled={loading && !isListening}
                   className={`h-16 w-16 rounded-full flex items-center justify-center transition-all ${
                      isListening ? 'bg-destructive text-destructive-foreground animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.6)]' : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 shadow-md'
                   }`}>
                   {isListening ? <Mic size={28} /> : <MicOff size={24} />}
                 </button>
              </div>
              <p className="text-center text-xs text-muted-foreground">Click to talk, click to stop.</p>
           </div>
        ) : (
           <div className="py-12 flex flex-col items-center justify-center text-center">
             <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Volume2 size={32} className="text-muted-foreground"/>
             </div>
             <p className="text-muted-foreground mb-4 max-w-md">Use this sandbox to talk directly to your LLM configuration for this campaign before deploying it to Asterisk / real phone numbers.</p>
           </div>
        )}
      </div>
    </div>
  );
}
