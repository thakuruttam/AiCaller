import textToSpeech from '@google-cloud/text-to-speech';
import { WebSocket } from 'ws';
import { createHash } from 'crypto';

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
// The WS path sends audio chunks to Plivo's buffer before the Flushed ACK
// arrives. If we fell back to REST on a Flushed timeout, both the WS chunks
// AND the REST response would sit in Plivo's buffer, playing twice.
// Fix: track _audioChunksDelivered each speak() call. On timeout:
//   - chunks > 0 → audio already in Plivo's buffer → resolve as success (no REST)
//   - chunks = 0 → nothing sent → reject so REST fallback is safe to use

const SPEAK_TIMEOUT_MS = 8000;

export class DeepgramTTSSocket {
  constructor(model = 'aura-2-asteria-en', format = 'mulaw') {
    this._model = model;
    this._format = format;
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
    const encoding = this._format === 'pcm16' ? 'linear16' : 'mulaw';
    const url = `wss://api.deepgram.com/v1/speak?model=${this._model}&encoding=${encoding}&container=none&sample_rate=8000`;
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
        // Raw mulaw audio chunk — count it and forward to Plivo immediately
        this._audioChunksDelivered++;
        try { this._audioHandler?.(data); } catch (e) { /* Plivo WS may have closed */ }
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
      // is in Plivo's buffer and will play. If no audio was sent, reject so the
      // caller falls back to REST cleanly.
      if (this._flushResolve) {
        if (this._audioChunksDelivered > 0) {
          console.log(`[TTS/DG-WS] Closed mid-speak but ${this._audioChunksDelivered} chunks delivered — resolving`);
          this._flushResolve();
        } else {
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
          // Audio is already in Plivo's buffer and will play.
          // Falling back to REST would add a second copy → double audio.
          console.warn(`[TTS/DG-WS] Flushed timeout but ${chunks} chunks delivered — resolving as success`);
          resolve();
        } else {
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

// ─── Audio cache ──────────────────────────────────────────────────────────────
// Scripted lines (questions, info, sign-off, greeting, retries) are now spoken
// verbatim without an LLM call (see VoiceAgent.sayVerbatim / lastReplyWasBypass)
// — which means the exact same text gets synthesized over and over across every
// call in a campaign. Cache the resulting audio bytes in Redis, keyed by the
// content itself, so repeat text skips TTS synthesis entirely on later calls.
// Content-addressed by the text's hash, so a script edit naturally produces a
// new key — no invalidation logic needed, stale entries just age out via TTL.

const TTS_CACHE_TTL_SECONDS = parseInt(process.env.TTS_CACHE_TTL_SECONDS || '2592000', 10); // 30 days

function ttsCacheKey(campaignId, language, text) {
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 24);
  return `ttscache:${campaignId || 'global'}:${language}:${hash}`;
}

async function getCachedAudio(redis, key) {
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn('[TTS Cache] Read failed:', err.message);
    return null;
  }
}

function setCachedAudio(redis, key, chunks) {
  // Fire-and-forget — this call's audio has already played; caching only
  // benefits future calls, so it must never add latency to this turn.
  redis.setex(key, TTS_CACHE_TTL_SECONDS, JSON.stringify(chunks))
    .then(() => console.log(`[TTS Cache] Cached ${chunks.length} chunk(s), key ${key}`))
    .catch(err => console.warn('[TTS Cache] Write failed:', err.message));
}

function playCachedAudio(ws, streamSid, chunks) {
  for (const chunk of chunks) {
    ws.send(JSON.stringify({
      event: 'playAudio',
      media: { contentType: 'audio/x-mulaw', sampleRate: 8000, payload: chunk }
    }));
  }
  sendCheckpoint(ws, streamSid);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Converts text to audio and streams it to the Plivo WebSocket.
 * Uses a persistent Deepgram WS when ttsSocket is provided (English only),
 * falling back to REST only if the WS fails before delivering any audio.
 *
 * @param {WebSocket}          ws          Plivo stream WebSocket
 * @param {string}             streamSid   Plivo streamId
 * @param {string}             text        Text to speak
 * @param {string}             language    'English' | 'Hindi' | 'Hinglish'
 * @param {DeepgramTTSSocket}  [ttsSocket] Per-call persistent socket (English only)
 * @param {Object}             [cacheOpts] { redis, campaignId, cacheable } — caching is
 *                                         English-only and skipped unless cacheable is
 *                                         true (the caller knows the text is scripted,
 *                                         not LLM-generated — see agent.lastReplyWasBypass).
 */
export async function speakBackToPlivo(ws, streamSid, text, language = 'English', ttsSocket = null, cacheOpts = null) {
  const cachingEnabled = language === 'English' && cacheOpts?.cacheable && cacheOpts?.redis;

  if (cachingEnabled) {
    const key = ttsCacheKey(cacheOpts.campaignId, language, text);
    const cached = await getCachedAudio(cacheOpts.redis, key);
    if (cached) {
      console.log(`[TTS Cache] HIT for "${text.substring(0, 60)}..."`);
      playCachedAudio(ws, streamSid, cached);
      return true;
    }
  }

  const provider = language === 'English' ? 'deepgram' : 'google';
  const mode = (provider === 'deepgram' && ttsSocket) ? 'ws' : 'rest';
  console.log(`[TTS] Generating audio via ${provider}/${mode} for: "${text.substring(0, 60)}..."`);

  const collector = cachingEnabled ? [] : null;
  let ok;
  if (provider === 'deepgram') {
    ok = ttsSocket
      ? await speakDeepgramWS(ws, streamSid, text, ttsSocket, collector)
      : await speakDeepgramREST(ws, streamSid, text, collector);
  } else {
    ok = await speakGoogle(ws, streamSid, text, language);
  }

  if (ok && collector && collector.length > 0) {
    setCachedAudio(cacheOpts.redis, ttsCacheKey(cacheOpts.campaignId, language, text), collector);
  }

  return ok;
}

function sendCheckpoint(ws, streamSid) {
  ws.send(JSON.stringify({
    event: 'checkpoint',
    streamId: streamSid,
    name: 'end_of_tts'
  }));
}

function sendAudioChunk(ws, base64Payload, collector) {
  ws.send(JSON.stringify({
    event: 'playAudio',
    media: { contentType: 'audio/x-mulaw', sampleRate: 8000, payload: base64Payload }
  }));
  if (collector) collector.push(base64Payload);
}

async function speakDeepgramWS(ws, streamSid, text, ttsSocket, collector = null) {
  try {
    await ttsSocket.speak(text, (chunk) => {
      sendAudioChunk(ws, chunk.toString('base64'), collector);
    });

    // Flushed received (or audio was sent and timeout fired) — mark end of audio
    sendCheckpoint(ws, streamSid);

    console.log('[TTS/DG-WS] Finished streaming audio to Plivo');
    return true;
  } catch (err) {
    // Only reaches here when zero audio was delivered (connection failure before open).
    // Plivo's buffer is empty so REST is safe to use.
    console.error('[TTS/DG-WS] Failed with no audio delivered — using REST fallback:', err.message);
    return speakDeepgramREST(ws, streamSid, text, collector);
  }
}

async function speakDeepgramREST(ws, streamSid, text, collector = null) {
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
      sendAudioChunk(ws, Buffer.from(value).toString('base64'), collector);
    }

    sendCheckpoint(ws, streamSid);

    console.log('[TTS/DG-REST] Finished streaming audio to Plivo');
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
        event: 'playAudio',
        media: { contentType: 'audio/x-mulaw', sampleRate: 8000, payload: audioBase64.slice(i, i + chunkSize) }
      }));
    }

    sendCheckpoint(ws, streamSid);

    console.log('[TTS/Google] Finished streaming audio to Plivo');
    return true;
  } catch (err) {
    console.error('[TTS/Google] Error:', err);
    return false;
  }
}
