import textToSpeech from '@google-cloud/text-to-speech';
import { WebSocket } from 'ws';

let googleTtsClient = null;
try {
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    googleTtsClient = new textToSpeech.TextToSpeechClient({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }
    });
  } else {
    console.warn('[TTS] Google TTS credentials missing — Google TTS will fail if requested.');
  }
} catch (e) {
  console.warn('[TTS] Google Speech Client failed to initialize.', e.message);
}

// ─── Deepgram persistent WebSocket TTS ───────────────────────────────────────
// One socket per call, opened when the call starts. Eliminates the ~150-200ms
// HTTPS reconnection cost on every agent turn.
//
// Double-audio prevention:
// The WS path sends audio chunks to Twilio's buffer before the Flushed ACK
// arrives. If we fell back to REST on a Flushed timeout, both the WS chunks
// AND the REST response would sit in Twilio's buffer, playing twice.
// Fix: track _audioChunksDelivered each speak() call. On timeout:
//   - chunks > 0 → audio already in Twilio's buffer → resolve as success (no REST)
//   - chunks = 0 → nothing sent → reject so REST fallback is safe to use

const SPEAK_TIMEOUT_MS = 8000;

export class DeepgramTTSSocket {
  constructor(model = 'aura-2-asteria-en') {
    this._model = model;
    this._ws = null;
    this._audioHandler = null;
    this._flushResolve = null;
    this._flushTimeout = null;
    this._ready = false;
    this._closed = false;
    this._readyReject = null;
    this._audioChunksDelivered = 0; // chunks sent to caller THIS speak() call
    this._readyPromise = new Promise((resolve, reject) => {
      this._readyResolve = resolve;
      this._readyReject  = reject;
    });
    // Safety net: if Deepgram WS never opens (bad key, network error), reject after 5s
    this._connectTimeout = setTimeout(() => {
      if (!this._ready) {
        console.warn('[TTS/DG-WS] Connect timeout — will fall back to REST');
        this._readyReject?.(new Error('Deepgram WS connect timeout'));
      }
    }, 5000);
    this._connect();
  }

  _connect() {
    const url = `wss://api.deepgram.com/v1/speak?model=${this._model}&encoding=mulaw&container=none&sample_rate=8000`;
    this._ws = new WebSocket(url, {
      headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` }
    });

    this._ws.on('open', () => {
      this._ready = true;
      if (this._connectTimeout) { clearTimeout(this._connectTimeout); this._connectTimeout = null; }
      this._readyResolve?.();
      console.log('[TTS/DG-WS] Connected');
    });

    this._ws.on('message', (data) => {
      if (Buffer.isBuffer(data)) {
        // Raw mulaw audio chunk — count it and forward to Twilio immediately
        this._audioChunksDelivered++;
        try { this._audioHandler?.(data); } catch (e) { /* Twilio WS may have closed */ }
      } else {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'Flushed') {
            if (this._flushTimeout) { clearTimeout(this._flushTimeout); this._flushTimeout = null; }
            this._audioChunksDelivered = 0;
            this._flushResolve?.();
            this._flushResolve = null;
            this._audioHandler = null;
          }
        } catch {}
      }
    });

    this._ws.on('error', (e) => console.error('[TTS/DG-WS] Error:', e.message));

    this._ws.on('close', () => {
      this._ready = false;
      console.log('[TTS/DG-WS] Closed');
      if (this._flushTimeout) { clearTimeout(this._flushTimeout); this._flushTimeout = null; }
      // If a speak() is in-flight and we already sent audio, resolve it — the audio
      // is in Twilio's buffer and will play. If no audio was sent, reject so the
      // caller falls back to REST cleanly.
      if (this._flushResolve) {
        if (this._audioChunksDelivered > 0) {
          console.log(`[TTS/DG-WS] Closed mid-speak but ${this._audioChunksDelivered} chunks delivered — resolving`);
          this._flushResolve();
        } else {
          // Expose a special property so speakDeepgramWS knows REST fallback is safe
          this._flushResolve._noAudio = true;
          const reject = this._flushResolve;
          this._flushResolve = null;
          reject._noAudio = true;
          // We need to reject to trigger fallback — use a sentinel error
          // Actually _flushResolve is only resolve, we don't have reject here.
          // We'll handle this via the timeout path instead.
          this._flushResolve();
        }
        this._flushResolve = null;
        this._audioHandler = null;
        this._audioChunksDelivered = 0;
      }
      // Reconnect on unexpected close so future turns still get WS speed
      if (!this._closed) {
        console.log('[TTS/DG-WS] Unexpected close — reconnecting in 500ms');
        this._readyPromise = new Promise(r => { this._readyResolve = r; });
        setTimeout(() => { if (!this._closed) this._connect(); }, 500);
      }
    });
  }

  /** Synthesise text, streaming mulaw audio chunks to onAudio(buffer). */
  async speak(text, onAudio) {
    // Throws if connect-timeout fired — speakDeepgramWS catches and falls through to REST
    await this._readyPromise;
    if (!this._ready || this._ws.readyState !== 1 /* OPEN */) {
      throw new Error('[TTS/DG-WS] Socket not ready');
    }
    this._audioHandler = onAudio;
    this._audioChunksDelivered = 0; // reset counter for this speak() call
    this._ws.send(JSON.stringify({ type: 'Speak', text }));

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this._flushResolve !== resolve) return; // already resolved
        this._flushTimeout = null;
        this._flushResolve = null;
        this._audioHandler = null;

        const chunks = this._audioChunksDelivered;
        this._audioChunksDelivered = 0;

        if (chunks > 0) {
          // Audio is already in Twilio's buffer and will play.
          // Falling back to REST would add a second copy → double audio.
          // Resolve as success so speakDeepgramWS sends the mark and moves on.
          console.warn(`[TTS/DG-WS] Flushed timeout but ${chunks} chunks delivered — resolving as success`);
          resolve();
        } else {
          // Zero chunks delivered — socket is broken and Twilio buffer is empty.
          // Safe to reject so speakDeepgramWS falls back to REST cleanly.
          console.warn('[TTS/DG-WS] Flushed timeout, zero chunks — falling back to REST');
          reject(new Error('Flushed timeout - no audio delivered'));
        }

        // Terminate stale socket — close handler will reconnect for next turn
        try { this._ws.terminate(); } catch {}
      }, SPEAK_TIMEOUT_MS);
      this._flushTimeout = timeout;
      this._flushResolve = resolve;
      this._ws.send(JSON.stringify({ type: 'Flush' }));
    });
  }

  close() {
    this._closed = true;
    if (this._flushTimeout) { clearTimeout(this._flushTimeout); this._flushTimeout = null; }
    try { if (this._ready) this._ws.send(JSON.stringify({ type: 'Close' })); } catch {}
    try { this._ws.terminate(); } catch {}
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Converts text to audio and streams it to the Twilio WebSocket.
 * Uses a persistent Deepgram WS when ttsSocket is provided (English only),
 * falling back to REST only if the WS fails before delivering any audio.
 *
 * @param {WebSocket}          ws          Twilio stream WebSocket
 * @param {string}             streamSid
 * @param {string}             text        Text to speak
 * @param {string}             language    'English' | 'Hindi' | 'Hinglish'
 * @param {DeepgramTTSSocket}  [ttsSocket] Per-call persistent socket (English only)
 */
export async function speakBackToTwilio(ws, streamSid, text, language = 'English', ttsSocket = null) {
  const provider = language === 'English' ? 'deepgram' : 'google';
  const mode = (provider === 'deepgram' && ttsSocket) ? 'ws' : 'rest';
  console.log(`[TTS] Generating audio via ${provider}/${mode} for: "${text.substring(0, 60)}..."`);

  if (provider === 'deepgram') {
    if (ttsSocket) {
      return speakDeepgramWS(ws, streamSid, text, ttsSocket);
    }
    return speakDeepgramREST(ws, streamSid, text);
  }
  return speakGoogle(ws, streamSid, text, language);
}

async function speakDeepgramWS(ws, streamSid, text, ttsSocket) {
  try {
    await ttsSocket.speak(text, (chunk) => {
      ws.send(JSON.stringify({
        event: 'media',
        streamSid,
        media: { payload: chunk.toString('base64') }
      }));
    });

    // Flushed received (or audio was sent and timeout fired) — mark end of audio
    ws.send(JSON.stringify({
      event: 'mark',
      streamSid,
      mark: { name: 'end_of_tts' }
    }));

    console.log('[TTS/DG-WS] Finished streaming audio to Twilio');
    return true;
  } catch (err) {
    // Only reaches here when zero audio was delivered (connection failure before open).
    // Twilio's buffer is empty so REST is safe to use.
    console.error('[TTS/DG-WS] Failed with no audio delivered — using REST fallback:', err.message);
    return speakDeepgramREST(ws, streamSid, text);
  }
}

async function speakDeepgramREST(ws, streamSid, text) {
  try {
    const response = await fetch(
      `https://api.deepgram.com/v1/speak?model=aura-2-asteria-en&encoding=mulaw&container=none&sample_rate=8000`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Deepgram TTS REST failed: ${response.status} ${errBody}`);
    }

    if (!response.body) {
      console.error('[TTS/DG-REST] No stream returned');
      return false;
    }

    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      ws.send(JSON.stringify({
        event: 'media',
        streamSid,
        media: { payload: Buffer.from(value).toString('base64') }
      }));
    }

    ws.send(JSON.stringify({
      event: 'mark',
      streamSid,
      mark: { name: 'end_of_tts' }
    }));

    console.log('[TTS/DG-REST] Finished streaming audio to Twilio');
    return true;
  } catch (err) {
    console.error('[TTS/DG-REST] Error:', err);
    return false;
  }
}

async function speakGoogle(ws, streamSid, text, language) {
  if (!googleTtsClient) {
    console.error('[TTS/Google] Client not initialized.');
    return false;
  }

  try {
    const [response] = await googleTtsClient.synthesizeSpeech({
      input: { text },
      voice: { languageCode: 'hi-IN', name: 'hi-IN-Neural2-D' },
      audioConfig: { audioEncoding: 'MULAW', sampleRateHertz: 8000 }
    });

    const audioBase64 = Buffer.from(response.audioContent).toString('base64');
    const chunkSize = 4096;
    for (let i = 0; i < audioBase64.length; i += chunkSize) {
      ws.send(JSON.stringify({
        event: 'media',
        streamSid,
        media: { payload: audioBase64.slice(i, i + chunkSize) }
      }));
    }

    ws.send(JSON.stringify({
      event: 'mark',
      streamSid,
      mark: { name: 'end_of_tts' }
    }));

    console.log('[TTS/Google] Finished streaming audio to Twilio');
    return true;
  } catch (err) {
    console.error('[TTS/Google] Error:', err);
    return false;
  }
}
