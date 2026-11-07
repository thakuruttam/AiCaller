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

// ── PCM16 → WAV (for Sarvam's REST STT, which needs a real file, not a raw
// stream) — mirrors providers/stt.js's own pcmToWav exactly. ─────────────
function pcm16ToWav(pcmBuffer, sampleRate) {
  const channels = 1, bitsPerSample = 16;
  const blockAlign = channels * bitsPerSample / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcmBuffer]);
}

// Confirmed on a real call: Gemini Live's OWN understanding of the caller's
// audio — both its transcription and, more importantly, its own decision-
// making (tool calls) — genuinely hallucinates on Indian-accented speech
// (a fabricated "Friedrich" that was never said, confirmed against two
// independent transcriptions of the same call). The user explicitly wants
// to keep everything else about Gemini (turn-detection, tool-calling,
// voice) and just fix what gets treated as "what the caller said" — so this
// re-transcribes each caller turn's own raw audio via Sarvam (proven
// accurate on every real call tested this session) and uses THAT for our
// own transcript/guards instead of Gemini's own inputTranscription.
// Necessarily async and necessarily a little late: it can only start once
// the turn's audio is fully buffered, so a tool call Gemini already fired
// mid-turn off its own (possibly wrong) understanding isn't retroactively
// undone — this fixes what gets recorded and what future turns are judged
// against, not a guaranteed instant correction of that exact turn.
async function retranscribeWithSarvam(mulawChunks) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey || mulawChunks.length === 0) return null;
  try {
    const mulaw = Buffer.concat(mulawChunks);
    const pcm8k = mulawBufferToPCM16(mulaw);
    const wav = pcm16ToWav(pcm8k, 8000);
    const form = new FormData();
    form.append('file', new Blob([wav], { type: 'audio/wav' }), 'turn.wav');
    form.append('model', 'saaras:v3');
    form.append('language_code', 'en-IN');
    form.append('mode', 'codemix');
    const res = await fetch('https://api.sarvam.ai/speech-to-text', {
      method: 'POST',
      headers: { 'api-subscription-key': apiKey },
      body: form
    });
    if (!res.ok) {
      console.warn(`[GeminiLive] Sarvam re-transcription failed (${res.status}) — falling back to Gemini's own transcript`);
      return null;
    }
    const data = await res.json();
    return (data.transcript ?? data.text ?? null)?.trim() || null;
  } catch (e) {
    console.warn('[GeminiLive] Sarvam re-transcription error — falling back to Gemini\'s own transcript:', e.message);
    return null;
  }
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
/**
 * How a forced line (closing line, re-ask, next question) is handed to the
 * model. English: word for word. Another language (Hinglish): the same line
 * said in that language — lines are written in English in the builder, and
 * word for word made Hinglish calls open and close in English (2026-11-06).
 */
export function speakDirective(text, speakIn) {
  if (speakIn && speakIn !== 'English') {
    return `(System: Say this to the caller in natural ${speakIn}, with exactly the same meaning and nothing added or left out — keep names, prices and numbers as they are. If it is already in ${speakIn}, say it as written: "${text}")`;
  }
  return `(System: Say this exact text verbatim, word for word, nothing else: "${text}")`;
}

export function setupGeminiLive(instructions, handlers, language = 'en', voiceOverride = null, tools = [], options = {}) {
  // Was 'gemini-2.5-flash-native-audio-preview-12-2025' — picked semi-
  // arbitrarily while verifying the wire protocol, never actually validated
  // for transcription/comprehension quality itself. Confirmed on a real test
  // call that model was both mistranscribing caller speech (into unrelated
  // languages) and failing to invoke answer_captured even on a clear, correct
  // transcript — i.e. failing the same way independent of whether the
  // separate transcription sub-system happened to get the words right,
  // meaning the primary audio-understanding model itself, not just transcription,
  // was the weak link. Switched to the model Google's own pricing docs
  // describe as "the primary current offering for real-time voice
  // conversations" instead of a preview checkpoint chosen without evidence.
  const model = process.env.GEMINI_LIVE_MODEL || 'models/gemini-3.1-flash-live-preview';
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
  let forceSpeakTimer = null;
  // The call's goodbye (speakClosing). Once set, it is the only thing left
  // to say: caller "interruptions" no longer cut it, and it is re-sent if
  // no audio for it arrives — on live calls (2026-11-07) a barge-in or a
  // turn that never completed swallowed it and the caller heard silence.
  let closingText = null;
  let closingSent = false;
  let closingHeard = false;
  let closingCut = false;
  let closingTries = 0;
  let closingDone = false;
  let closingTimer = null;
  const CLOSING_AUDIO_WAIT_MS = Number(process.env.GEMINI_CLOSING_AUDIO_WAIT_MS) || 4000;
  // True from a force-sent line until its first audio: a turnComplete with
  // no audio before then is the late end of the muted turn, not this line.
  let forcedAwaitingAudio = false;
  // True from the moment the model starts producing a turn (audio,
  // transcript or a tool call) until its turnComplete/interrupted. Unlike
  // botSpeaking, this is also set for turns the model starts on its own in
  // reply to the caller — the case interruptAndSpeak must be able to mute.
  let responseInFlight = false;
  // Set when the SERVER mutes a reply (muteInFlight / interruptAndSpeak): the
  // caller never heard it, so its text is dropped rather than saved to the
  // transcript. A caller barge-in doesn't set this — those words were heard.
  let dropMutedText = false;
  let assistantTranscriptBuffer = '';
  let inputTranscriptBuffer = '';
  let sawAudioThisTurn = false;
  // Raw mulaw chunks for the caller's CURRENT turn, so it can be re-sent to
  // Sarvam once the turn ends — see retranscribeWithSarvam's comment above.
  let currentTurnMulawChunks = [];

  function flushPendingSpeak() {
    if (pendingSpeakText !== null) {
      clearTimeout(forceSpeakTimer);
      const text = pendingSpeakText;
      pendingSpeakText = null;
      sendSpeak(text);
    }
  }

  function sendClosing() {
    if (!closingText || closingDone || !ready || ws.readyState !== WebSocket.OPEN) return;
    clearTimeout(forceSpeakTimer);
    clearTimeout(closingTimer);
    closingTries += 1;
    closingSent = true;
    closingHeard = false;
    closingCut = false;
    pendingSpeakText = null;
    responseCancelPending = false;
    dropMutedText = false;
    assistantTranscriptBuffer = '';
    responseInFlight = false;
    sawAudioThisTurn = false;
    forcedAwaitingAudio = false;
    console.log(`[GeminiLive] Speaking the goodbye (attempt ${closingTries}): "${closingText}"`);
    sendSpeak(closingText);
    closingTimer = setTimeout(() => {
      if (closingDone || closingHeard) return;
      if (closingTries >= 3) {
        console.warn('[GeminiLive] Goodbye produced no audio after 3 attempts — giving up');
        return;
      }
      console.warn(`[GeminiLive] No goodbye audio within ${CLOSING_AUDIO_WAIT_MS}ms — sending it again`);
      sendClosing();
    }, CLOSING_AUDIO_WAIT_MS);
  }

  function sendSpeak(text) {
    botSpeaking = true;
    ws.send(JSON.stringify({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: speakDirective(text, options.speakIn) }] }],
        turnComplete: true
      }
    }));
  }

  async function flushInputTranscript() {
    const geminiText = inputTranscriptBuffer.trim();
    inputTranscriptBuffer = '';
    const turnAudio = currentTurnMulawChunks;
    currentTurnMulawChunks = [];
    if (!geminiText) return;

    const sarvamText = await retranscribeWithSarvam(turnAudio);
    // Sarvam bills per second of audio sent (8 kHz mu-law: 8000 bytes a second).
    if (process.env.SARVAM_API_KEY && turnAudio.length) {
      handlers.onSarvamAudio?.(turnAudio.reduce((n, b) => n + b.length, 0) / 8000);
    }
    const text = sarvamText || geminiText;
    if (sarvamText && sarvamText !== geminiText) {
      console.log(`[GeminiLive] Sarvam re-transcription differs from Gemini's own — using Sarvam: Gemini said "${geminiText}", Sarvam says "${sarvamText}"`);
    }
    console.log(`[GeminiLive] Transcript (VAD decided turn is complete): "${text}"`);
    handlers.onTranscript(text);
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
        // Conversation campaigns pass a lower temperature so the model sticks
        // to the knowledge base instead of improvising (see plivoStreamHandler).
        ...(typeof options.temperature === 'number' ? { temperature: options.temperature } : {}),
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }
      },
      systemInstruction: { parts: [{ text: instructions }] },
      outputAudioTranscription: {},
      inputAudioTranscription: {},
      // How long Gemini waits after the caller stops before it replies.
      // The defaults waited noticeably long on live calls (2026-11-07):
      // high end-of-speech sensitivity and a shorter silence window answer
      // sooner. Tunable per env without a code change.
      realtimeInputConfig: {
        automaticActivityDetection: {
          endOfSpeechSensitivity: process.env.GEMINI_VAD_END_SENSITIVITY || 'END_SENSITIVITY_HIGH',
          silenceDurationMs: Number(process.env.GEMINI_VAD_SILENCE_MS) || 600,
          prefixPaddingMs: 20
        }
      }
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

    // Gemini reports token usage on server messages — passed up so the call's
    // real model cost can be recorded (CallLog.usage).
    if (msg.usageMetadata) handlers.onUsage?.(msg.usageMetadata);

    if (msg.toolCall?.functionCalls) {
      responseInFlight = true;
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

    if (sc.interrupted && closingText) {
      // Saying goodbye: the caller talking over it must not silence it.
      if (closingHeard) closingCut = true;
      console.log('[GeminiLive] Caller spoke during the goodbye — not treated as a barge-in');
      return;
    }

    if (sc.interrupted) {
      responseInFlight = false;
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
      responseInFlight = true;
      assistantTranscriptBuffer += sc.outputTranscription.text;
    }

    if (sc.modelTurn?.parts) {
      responseInFlight = true;
      for (const part of sc.modelTurn.parts) {
        if (part.thought) continue; // internal reasoning — never spoken, never forwarded
        if (part.inlineData?.data && !responseCancelPending && !closingDone) {
          if (closingText && !closingSent) continue; // the muted turn, before the goodbye was sent
          if (closingText) closingHeard = true;
          sawAudioThisTurn = true;
          forcedAwaitingAudio = false;
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

    if (sc.turnComplete && closingText) {
      if (closingDone) return;
      if (!closingSent) { sendClosing(); return; } // the muted turn finished — say the goodbye now
      if (!closingHeard) return; // a stale turn end; closingTimer re-sends if no audio comes
      if (closingCut && closingTries < 3) { sendClosing(); return; } // cut off mid-way — say it whole
      closingDone = true;
      clearTimeout(closingTimer);
      botSpeaking = false;
      responseInFlight = false;
      flushAssistantTranscript();
      handlers.onResponseDone?.(true);
      return;
    }

    if (sc.turnComplete) {
      if (forcedAwaitingAudio && !sawAudioThisTurn) {
        forcedAwaitingAudio = false;
        assistantTranscriptBuffer = '';
        console.log('[GeminiLive] Late turnComplete of the muted turn — ignored, the forced line is still coming');
        return;
      }
      botSpeaking = false;
      responseInFlight = false;
      if (dropMutedText) {
        dropMutedText = false;
        assistantTranscriptBuffer = '';
      }
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
    clearTimeout(forceSpeakTimer);
    clearTimeout(closingTimer);
    console.log('[GeminiLive] Connection closed');
    handlers.onClose?.();
  });

  return {
    sendAudio(mulawBuffer) {
      if (botSpeaking) return; // half-duplex — see responseCancelPending comment above
      if (ready && ws.readyState === WebSocket.OPEN) {
        currentTurnMulawChunks.push(mulawBuffer); // for the Sarvam re-transcription pass — see retranscribeWithSarvam
        ws.send(JSON.stringify({
          realtimeInput: { audio: { data: mulaw8kToPCM16kBase64(mulawBuffer), mimeType: 'audio/pcm;rate=16000' } }
        }));
      }
    },

    speak(text) {
      if (closingText) return; // the goodbye owns the rest of the call
      if (!ready || ws.readyState !== WebSocket.OPEN || botSpeaking) {
        pendingSpeakText = text;
        return;
      }
      sendSpeak(text);
    },

    /**
     * Stop whatever the model is saying right now without queueing anything
     * new — used the instant the model calls end_call, before the server's
     * (async) check decides what to say instead. The forced line follows
     * via interruptAndSpeak once that check resolves.
     */
    muteInFlight() {
      if (!(botSpeaking || responseInFlight)) return;
      console.log('[GeminiLive] Muting in-flight response');
      responseCancelPending = true;
      dropMutedText = true;
      handlers.onClearPlayback?.();
    },

    /**
     * The call's last line: cut whatever the model is saying, then say this
     * and nothing else. onResponseDone(true) fires once it has played out.
     */
    speakClosing(text) {
      if (closingText) return;
      closingText = text;
      if (botSpeaking || responseInFlight || responseCancelPending) {
        console.log(`[GeminiLive] Muting in-flight response for the goodbye: "${text}"`);
        responseCancelPending = true;
        dropMutedText = true;
        handlers.onClearPlayback?.();
        // Don't wait long for the muted turn to finish (it sometimes never does).
        clearTimeout(forceSpeakTimer);
        forceSpeakTimer = setTimeout(() => { if (!closingSent) sendClosing(); }, Number(process.env.GEMINI_FORCE_SPEAK_WAIT_MS) || 1200);
        return;
      }
      sendClosing();
    },

    interruptAndSpeak(text) {
      if (closingText) return; // the goodbye owns the rest of the call
      // Gemini Live has no "cancel the in-flight response" message like
      // OpenAI's response.cancel, and sending a new turn mid-response did
      // NOT stop the old one: on a live call (2026-11-05) the model's own
      // "We won't be moving forward with your..." kept playing after the
      // server had already overruled its end_call. So instead: drop the
      // rest of the in-flight response's audio (responseCancelPending, the
      // same gate barge-in uses), tell the handler to flush what Plivo has
      // already buffered, and queue the forced text — turnComplete for the
      // muted response flushes it via flushPendingSpeak().
      if (botSpeaking || responseInFlight) {
        console.log(`[GeminiLive] Muting in-flight response to force: "${text}"`);
        responseCancelPending = true;
        dropMutedText = true;
        pendingSpeakText = text;
        handlers.onClearPlayback?.();
        // Don't wait forever for the muted turn to finish: on a live call
        // (2026-11-07) its turnComplete never came after end_call, the
        // goodbye sat in the queue and the caller got 15s of silence before
        // the hangup. If it's still queued shortly after, say it anyway.
        clearTimeout(forceSpeakTimer);
        forceSpeakTimer = setTimeout(() => {
          if (pendingSpeakText !== text || !ready || ws.readyState !== WebSocket.OPEN) return;
          console.warn(`[GeminiLive] Muted turn never completed — speaking the forced line anyway: "${text}"`);
          pendingSpeakText = null;
          responseCancelPending = false;
          dropMutedText = false;
          assistantTranscriptBuffer = '';
          responseInFlight = false;
          sawAudioThisTurn = false;
          forcedAwaitingAudio = true;
          sendSpeak(text);
        }, Number(process.env.GEMINI_FORCE_SPEAK_WAIT_MS) || 1200);
        return;
      }
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
