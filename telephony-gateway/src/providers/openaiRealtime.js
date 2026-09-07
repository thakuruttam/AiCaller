import { WebSocket } from 'ws';

// ── OpenAI Realtime voice engine ─────────────────────────────────────────
// Replaces the STT (providers/stt.js) + TTS (providers/tts.js) + our own
// silence-timer turn-taking (plivoStreamHandler.js's TRANSCRIPT_IDLE_MS/
// SETTLE_MS/maybeFlush machinery) with one system that does all three and
// decides "the caller is done talking" using semantic_vad — a turn-
// detection mode that reads the WORDS spoken, not just a silence duration,
// specifically to avoid the class of bug chased all day: a fixed timer
// cutting someone off mid-sentence, or accepting an obviously incomplete
// answer just because it happened to pause for N seconds.
//
// Plivo's <Stream> media is mulaw-encoded, 8kHz, base64, in 20ms frames —
// the Realtime API's 'audio/pcmu' format (PCMU = G.711 mu-law) is the exact
// same encoding, so audio passes through in both directions with NO
// decode/encode step, unlike the old pipeline's PCM16 conversion in
// providers/stt.js.
//
// NOTE ON WIRE FORMAT: confirmed directly against the live API across two
// real rejections, in order: (1) `audio.input.format` / `audio.output.format`
// must be an OBJECT ({ type: ... }), not a bare string; (2) the only type
// values it accepts are 'audio/pcm', 'audio/pcmu', 'audio/pcma' — NOT the
// 'g711_ulaw' name used in older/beta docs and examples elsewhere. If a
// future session.update error shows up here again, trust that error message
// over any scraped documentation — this is a fast-moving API and docs lag
// behind it.

/**
 * @param {string} instructions - System prompt equivalent (goal, contact name,
 *   tone/verbatim rules). Kept separate from per-turn text so it's set once
 *   at session start, same role as VoiceAgent's system prompt today.
 * @param {Object} handlers - {
 *   onTranscript: (text) => void,      // fires once semantic_vad decides a turn is complete
 *   onAudio: (chunk: Buffer) => void,  // raw g711_ulaw audio chunk to forward to Plivo's playAudio
 *   onSpeechStart: () => void,         // caller started talking WHILE we're still speaking (barge-in)
 *   onResponseDone: () => void,        // the bot's current spoken reply has fully finished playing
 *   onError: (err) => void,
 *   onClose: () => void
 * }
 * @returns {{ sendAudio: (mulawBuffer: Buffer) => void, speak: (text: string) => void, close: () => void }}
 */
export function setupRealtime(instructions, handlers) {
  const model     = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
  const eagerness = process.env.OPENAI_REALTIME_EAGERNESS || 'low'; // low = give the caller more room before deciding they're done
  const voice     = process.env.OPENAI_REALTIME_VOICE || 'alloy';

  const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${model}`, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    }
  });

  let ready = false;
  // True from when we ask the model to speak until its response finishes —
  // used the same way plivoStreamHandler.js's `isSpeaking` is used today,
  // to distinguish a real barge-in (caller interrupting OUR speech) from
  // ordinary speech-start detection on their own turn.
  let botSpeaking = false;

  ws.on('open', () => {
    ready = true;
    ws.send(JSON.stringify({
      type: 'session.update',
      session: {
        type: 'realtime',
        instructions,
        audio: {
          input: {
            format: { type: 'audio/pcmu' },
            turn_detection: {
              type: 'semantic_vad',
              eagerness
            }
          },
          output: {
            format: { type: 'audio/pcmu' },
            voice
          }
        }
      }
    }));
    console.log(`[Realtime] Session opened — model=${model}, turn_detection=semantic_vad(eagerness=${eagerness})`);
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      return;
    }

    switch (msg.type) {
      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = msg.transcript?.trim();
        if (transcript) {
          console.log(`[Realtime] Transcript (semantic_vad decided turn is complete): "${transcript}"`);
          handlers.onTranscript(transcript);
        }
        break;
      }

      case 'response.audio.delta':
        if (msg.delta) handlers.onAudio?.(Buffer.from(msg.delta, 'base64'));
        break;

      case 'input_audio_buffer.speech_started':
        // Only a real interruption if we were the one talking — otherwise
        // this is just the normal start of the caller's own turn.
        if (botSpeaking) {
          console.log('[Realtime] Caller started speaking while bot was talking — barge-in');
          handlers.onSpeechStart?.();
        }
        break;

      case 'response.done':
        botSpeaking = false;
        handlers.onResponseDone?.();
        break;

      case 'error':
        console.error('[Realtime] Server error:', JSON.stringify(msg.error || msg));
        handlers.onError?.(new Error(msg.error?.message || 'Realtime API error'));
        break;
    }
  });

  ws.on('error', (err) => {
    console.error('[Realtime] WebSocket error:', err.message);
    handlers.onError?.(err);
  });

  ws.on('close', () => {
    ready = false;
    console.log('[Realtime] Connection closed');
    handlers.onClose?.();
  });

  return {
    sendAudio(mulawBuffer) {
      if (ready && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'input_audio_buffer.append',
          audio: mulawBuffer.toString('base64')
        }));
      }
    },

    /**
     * Speak exact text verbatim — same "say this exact text" contract
     * VoiceAgent.js's directives already rely on today, reused here rather
     * than inventing a new mechanism. The realtime model still has to
     * follow this instruction rather than it being a hard guarantee, same
     * as today's non-realtime path.
     */
    speak(text) {
      if (!ready || ws.readyState !== WebSocket.OPEN) return;
      botSpeaking = true;
      ws.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: `(System: Say this exact text verbatim, word for word, nothing else: "${text}")` }]
        }
      }));
      ws.send(JSON.stringify({ type: 'response.create' }));
    },

    close() {
      try { ws.close(); } catch (e) {}
    }
  };
}
