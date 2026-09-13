import { WebSocket } from 'ws';

// ── Gemini Live voice engine ──────────────────────────────────────────────
// Alternative to providers/openaiRealtime.js for autonomous-mode calls —
// confirmed on a real recording (Sept 2026, Pradeep/Complex-Logic-Test call)
// that OpenAI's Realtime STT was fabricating and inverting caller answers on
// Indian-accented audio (e.g. "yeah, this side Pradeep" transcribed as "that
// is my brother"), independently corroborated against BOTH Sarvam and Gemini
// batch transcription of the same recording. This file swaps OpenAI's
// gpt-realtime for Gemini's native audio-in/audio-out model instead, keeping
// the exact same turn-detection + tool-calling + speak() architecture — see
// setupRealtime's own header comment for why that shape exists at all.
//
// WIRE FORMAT — confirmed directly against the live API (not just docs, which
// disagreed with each other on where responseModalities nests):
//   wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=API_KEY
//   → setup: { model, generationConfig: { responseModalities: ['AUDIO'] },
//              systemInstruction: { parts: [{ text }] },
//              outputAudioTranscription: {}, inputAudioTranscription: {},
//              realtimeInputConfig: { automaticActivityDetection: {} },
//              tools: [{ functionDeclarations: [...] }] }
//   ← setupComplete: {}
//   → realtimeInput: { audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } }
//   ← serverContent.modelTurn.parts[].inlineData: { mimeType: 'audio/pcm;rate=24000', data }
//   ← serverContent.outputTranscription.text  (assistant's own speech, streamed word-by-word)
//   ← serverContent.inputTranscription.text   (caller's speech — NOT yet confirmed against
//        real audio input in this session, only against a text-only probe turn; the flush
//        boundary logic below (flushing on the next turn's first input-transcription chunk)
//        is a best-effort interpretation pending a real test call, same as several
//        openaiRealtime.js details that only got nailed down through live-call iteration)
//   ← serverContent.generationComplete: true, then serverContent.turnComplete: true
//   ← serverContent.interrupted: true          (barge-in signal)
//   ← toolCall.functionCalls[]: { name, id, args }
//   → toolResponse.functionResponses[]: { id, name, response }
//
// AUDIO FORMAT MISMATCH — unlike OpenAI Realtime's 'audio/pcmu', which is the
// exact same mulaw Plivo already sends/expects (zero conversion), Gemini
// requires raw 16-bit PCM: 16kHz for input, 24kHz for output. Plivo is 8kHz
// mulaw both ways. That means real transcoding both directions — mulaw
// decode + upsample 8k→16k on input, downsample 24k→8k + mulaw encode on
// output — all done inline below, since nothing in this codebase already
// does PCM16→mulaw encoding (only the reverse, in providers/stt.js).

// ── mulaw ⇄ PCM16 (G.711 mu-law, the standard telephony algorithm) ────────
// Matches providers/stt.js's own MULAW_DECODE table exactly (verified byte-
// for-byte against it) — that version is already proven in production;
// an earlier draft of this table subtracted the 0x84 bias asymmetrically
// between the positive and negative branches, silently corrupting half the
// lookup table. Caught by diffing against the known-good table before this
// ever reached a real call.
const MULAW_DECODE = new Int16Array(256);
(function buildMulawDecodeTable() {
  for (let i = 0; i < 256; i++) {
    const b = ~i & 0xFF;
    const sign = b & 0x80;
    const exp = (b >> 4) & 0x07;
    const mant = b & 0x0F;
    const linear = ((mant << 3) + 0x84) << exp;
    MULAW_DECODE[i] = sign ? -linear : linear;
  }
})();

// CLIP=32635 is the standard ITU-T ceiling for full 16-bit signed PCM input
// (not the 8159/0x1FFF figure that shows up in some reference code — that
// applies only when the input has already been pre-scaled to 14 bits, which
// ours has not). Caught via a round-trip test against MULAW_DECODE: with the
// wrong constant, any sample above ~8000 (i.e. completely ordinary speech
// volume, not even loud) silently clamped to the same output byte, which
// would have made every real call sound badly clipped/distorted.
const MULAW_CLIP = 32635;
const MULAW_BIAS = 0x84;

function linearToMulaw(sample) {
  let sign = (sample >> 8) & 0x80;
  if (sign !== 0) sample = -sample;
  if (sample > MULAW_CLIP) sample = MULAW_CLIP;
  sample += MULAW_BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (sample & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (sample >> (exponent + 3)) & 0x0F;
  return ~(sign | (exponent << 4) | mantissa) & 0xFF;
}

function mulawBufferToPCM16(mulawBuffer) {
  const pcm = Buffer.alloc(mulawBuffer.length * 2);
  for (let i = 0; i < mulawBuffer.length; i++) {
    pcm.writeInt16LE(MULAW_DECODE[mulawBuffer[i]], i * 2);
  }
  return pcm;
}

function pcm16ToMulawBuffer(pcmBuffer) {
  const sampleCount = pcmBuffer.length / 2;
  const mulaw = Buffer.alloc(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    mulaw[i] = linearToMulaw(pcmBuffer.readInt16LE(i * 2));
  }
  return mulaw;
}

// Simple linear-interpolation resample — adequate for telephony voice
// quality (this is what most voice-agent bridges do in practice), not a
// broadcast-grade resampler. Good enough to validate the pipeline; revisit
// only if a real call shows audible artifacts.
function resamplePCM16(pcmBuffer, fromRate, toRate) {
  if (fromRate === toRate) return pcmBuffer;
  const inSamples = pcmBuffer.length / 2;
  const outSamples = Math.round(inSamples * (toRate / fromRate));
  const out = Buffer.alloc(outSamples * 2);
  const ratio = inSamples / outSamples;
  for (let i = 0; i < outSamples; i++) {
    const srcPos = i * ratio;
    const idx0 = Math.floor(srcPos);
    const idx1 = Math.min(idx0 + 1, inSamples - 1);
    const frac = srcPos - idx0;
    const s0 = pcmBuffer.readInt16LE(idx0 * 2);
    const s1 = pcmBuffer.readInt16LE(idx1 * 2);
    out.writeInt16LE(Math.round(s0 + (s1 - s0) * frac), i * 2);
  }
  return out;
}

function mulaw8kToPCM16kBase64(mulawBuffer) {
  const pcm8k = mulawBufferToPCM16(mulawBuffer);
  const pcm16k = resamplePCM16(pcm8k, 8000, 16000);
  return pcm16k.toString('base64');
}

function pcm24kBase64ToMulaw8k(base64Data) {
  const pcm24k = Buffer.from(base64Data, 'base64');
  const pcm8k = resamplePCM16(pcm24k, 24000, 8000);
  return pcm16ToMulawBuffer(pcm8k);
}

// Converts this codebase's OpenAI-Realtime-shaped tool definitions
// ({ type: 'function', name, description, parameters }) into Gemini's
// functionDeclarations shape ({ name, description, parameters } — no
// 'type' field). Confirmed against the live API in this session.
function toGeminiFunctionDeclarations(tools) {
  return tools.map(({ name, description, parameters }) => ({ name, description, parameters }));
}

/**
 * @param {string} instructions - Confirmed live: Gemini Live rejects a second
 *   'setup' message outright (closes with 1007 invalid_argument), unlike
 *   OpenAI Realtime's session.update. There is no scripted-greeting-then-
 *   switch-to-autonomous two-phase flow for this provider — instructions
 *   must be the FULL final instructions (greeting + identity check +
 *   questions), and tools must be the full tool set, both supplied here at
 *   construction time. beginAutonomousConversation() below is a no-op for
 *   exactly this reason.
 * @param {Object} handlers - same contract as providers/openaiRealtime.js's setupRealtime
 * @param {string} [language]
 * @param {string} [voiceOverride] - Gemini prebuilt voice name (e.g. 'Kore', 'Puck'), falls back to GEMINI_LIVE_VOICE then 'Kore'.
 * @param {object[]} [tools] - OpenAI-Realtime-shaped tool definitions (see AUTONOMOUS_TOOLS in
 *   plivoStreamHandler.js), converted to Gemini's functionDeclarations shape and declared in the
 *   initial setup message — the only point Gemini accepts them.
 * @returns {{ sendAudio, speak, interruptAndSpeak, beginAutonomousConversation, continueConversation, close }}
 */
export function setupGeminiLive(instructions, handlers, language = 'en', voiceOverride = null, tools = []) {
  const model = process.env.GEMINI_LIVE_MODEL || 'models/gemini-2.5-flash-native-audio-preview-12-2025';
  const voice = voiceOverride || process.env.GEMINI_LIVE_VOICE || 'Kore';
  const apiKey = process.env.GEMINI_API_KEY;

  const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`);

  let ready = false;
  let pendingSpeakText = null;
  let botSpeaking = false;
  // See openaiRealtime.js's identical flag for the full reasoning — a
  // confirmed-live-call fix carried over unchanged: withhold caller audio
  // entirely while the bot is speaking so the model has nothing to mishear
  // its own voice/line-echo as caller speech from. Doubly relevant here
  // since Gemini's VAD is a traditional acoustic one, not OpenAI's
  // completion-aware semantic_vad — it has no linguistic sense to fall back
  // on if it mistakes echo for real speech.
  let responseCancelPending = false;
  let assistantTranscriptBuffer = '';
  let inputTranscriptBuffer = '';
  let sawAudioThisTurn = false;

  function flushPendingSpeak() {
    if (pendingSpeakText !== null) {
      const text = pendingSpeakText;
      pendingSpeakText = null;
      sendSpeak(text);
    }
  }

  function sendSpeak(text) {
    botSpeaking = true;
    ws.send(JSON.stringify({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: `(System: Say this exact text verbatim, word for word, nothing else: "${text}")` }] }],
        turnComplete: true
      }
    }));
  }

  function flushInputTranscript() {
    const text = inputTranscriptBuffer.trim();
    inputTranscriptBuffer = '';
    if (text) {
      console.log(`[GeminiLive] Transcript (VAD decided turn is complete): "${text}"`);
      handlers.onTranscript(text);
    }
  }

  function flushAssistantTranscript() {
    const text = assistantTranscriptBuffer.trim();
    assistantTranscriptBuffer = '';
    if (text) handlers.onAssistantTranscript?.(text);
  }

  ws.on('open', () => {
    const setup = {
      model,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
      },
      systemInstruction: { parts: [{ text: instructions }] },
      outputAudioTranscription: {},
      inputAudioTranscription: {},
      realtimeInputConfig: { automaticActivityDetection: {} }
    };
    if (tools.length > 0) {
      setup.tools = [{ functionDeclarations: toGeminiFunctionDeclarations(tools) }];
    }
    ws.send(JSON.stringify({ setup }));
    console.log(`[GeminiLive] setup sent — model=${model}, voice=${voice}, tools=${tools.map(t => t.name).join(',') || '(none)'}`);
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      return;
    }

    if (msg.setupComplete) {
      ready = true;
      console.log(`[GeminiLive] Session opened — model=${model}, voice=${voice}`);
      flushPendingSpeak();
      handlers.onReady?.();
      return;
    }

    if (msg.toolCall?.functionCalls) {
      for (const call of msg.toolCall.functionCalls) {
        console.log(`[GeminiLive] Tool call: ${call.name}(${JSON.stringify(call.args)})`);
        handlers.onToolCall?.(call.name, call.args || {});
        ws.send(JSON.stringify({
          toolResponse: { functionResponses: [{ id: call.id, name: call.name, response: { result: 'ok' } }] }
        }));
      }
      return;
    }

    const sc = msg.serverContent;
    if (!sc) return;

    if (sc.interrupted) {
      console.log('[GeminiLive] Caller started speaking while bot was talking — barge-in');
      responseCancelPending = true;
      botSpeaking = false;
      handlers.onSpeechStart?.();
      return;
    }

    if (sc.inputTranscription?.text) {
      // First chunk of a fresh input turn arriving right after we'd already
      // flushed — accumulate. handlers.onSpeechActivity fires per-chunk as
      // the cheapest available proxy for "caller is actively talking",
      // since (unlike OpenAI) there's no distinct explicit speech-started
      // event exposed separately from transcription itself.
      handlers.onSpeechActivity?.();
      inputTranscriptBuffer += sc.inputTranscription.text;
    }

    if (sc.outputTranscription?.text) {
      assistantTranscriptBuffer += sc.outputTranscription.text;
    }

    if (sc.modelTurn?.parts) {
      for (const part of sc.modelTurn.parts) {
        if (part.thought) continue; // internal reasoning — never spoken, never forwarded
        if (part.inlineData?.data && !responseCancelPending) {
          sawAudioThisTurn = true;
          handlers.onAudio?.(pcm24kBase64ToMulaw8k(part.inlineData.data));
        }
      }
    }

    if (sc.generationComplete) {
      // Caller's turn that led to this response is now fully answered —
      // flush its accumulated transcript now, same moment OpenAI's discrete
      // transcription-completed event would have fired.
      flushInputTranscript();
    }

    if (sc.turnComplete) {
      botSpeaking = false;
      flushAssistantTranscript();
      if (responseCancelPending) {
        responseCancelPending = false;
        sawAudioThisTurn = false;
        flushPendingSpeak();
        return;
      }
      const hadAudio = sawAudioThisTurn;
      sawAudioThisTurn = false;
      if (!hadAudio) {
        console.warn('[GeminiLive] Turn completed with ZERO audio — nothing was spoken.');
      }
      handlers.onResponseDone?.(hadAudio);
      flushPendingSpeak();
    }
  });

  ws.on('error', (err) => {
    console.error('[GeminiLive] WebSocket error:', err.message);
    handlers.onError?.(err);
  });

  ws.on('close', () => {
    ready = false;
    console.log('[GeminiLive] Connection closed');
    handlers.onClose?.();
  });

  return {
    sendAudio(mulawBuffer) {
      if (botSpeaking) return; // half-duplex — see responseCancelPending comment above
      if (ready && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          realtimeInput: { audio: { data: mulaw8kToPCM16kBase64(mulawBuffer), mimeType: 'audio/pcm;rate=16000' } }
        }));
      }
    },

    speak(text) {
      if (!ready || ws.readyState !== WebSocket.OPEN || botSpeaking) {
        pendingSpeakText = text;
        return;
      }
      sendSpeak(text);
    },

    interruptAndSpeak(text) {
      // Gemini Live's WebSocket protocol has no documented explicit
      // "cancel the in-flight response" message analogous to OpenAI's
      // response.cancel (unconfirmed either way against the live API in
      // this session — not something a text-only probe turn could trigger).
      // Sending the next turn while one is in flight is the best available
      // approximation until that's verified on a real call.
      botSpeaking = false;
      this.speak(text);
    },

    continueConversation() {
      if (!ready || ws.readyState !== WebSocket.OPEN || botSpeaking) return;
      botSpeaking = true;
      // Confirmed live: an empty turns:[] array is flatly rejected (closes
      // the whole connection with 1007 invalid_argument) — unlike OpenAI's
      // bare response.create, Gemini needs an actual non-empty turn to
      // trigger generation. A minimal placeholder does the job.
      ws.send(JSON.stringify({
        clientContent: { turns: [{ role: 'user', parts: [{ text: '(continue)' }] }], turnComplete: true }
      }));
    },

    beginAutonomousConversation(newInstructions, newTools) {
      // Deliberate no-op — see the constructor's doc comment. Gemini Live
      // rejects a second setup message outright, so there is no mid-session
      // switch to perform: instructions and tools were already declared in
      // full when this session was opened.
      console.warn('[GeminiLive] beginAutonomousConversation() called, but this provider declares instructions and tools once at setup() time — ignoring. Pass the full autonomous instructions/tools to setupGeminiLive() up front instead.');
    },

    close() {
      try { ws.close(); } catch (e) {}
    }
  };
}
