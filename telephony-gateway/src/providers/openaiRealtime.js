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
 *   onSpeechActivity: () => void,      // caller started talking at all — use to reset a silence/idle timeout
 *   onResponseDone: () => void,        // the bot's current spoken reply has fully finished playing
 *   onError: (err) => void,
 *   onClose: () => void,
 *   onToolCall: (name: string, args: object) => void,          // autonomous mode only
 *   onAssistantTranscript: (text: string) => void               // autonomous mode only — what the model itself just said
 * }
 * @param {string} [voiceOverride] - Per-campaign voice choice (campaign.callSettings.voice), e.g.
 *   'marin'/'cedar' (OpenAI's newest, most natural-sounding options) or any other Realtime API voice.
 *   Falls back to OPENAI_REALTIME_VOICE, then 'alloy', when not provided.
 * @returns {{ sendAudio: (mulawBuffer: Buffer) => void, speak: (text: string) => void, interruptAndSpeak: (text: string) => void, beginAutonomousConversation: (instructions: string, tools: object[]) => void, continueConversation: () => void, close: () => void }}
 */
export function setupRealtime(instructions, handlers, language = 'en', voiceOverride = null) {
  const model     = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime';
  // 'low' was adding several seconds of dead air to every turn once the
  // per-turn merge-grace buffer was removed (see handleRealtimeTranscript in
  // plivoStreamHandler.js). Tried 'high' next — confirmed on a live call to
  // fragment normal continuous speech into separate single-word turns
  // ("It" / "my name" split from one sentence), which then got individually
  // treated as complete answers and advanced the script incorrectly.
  // 'medium' is the middle ground pending further live validation — neither
  // extreme held up against real speech patterns.
  const eagerness = process.env.OPENAI_REALTIME_EAGERNESS || 'medium';
  // Per-campaign choice (campaign.callSettings.voice) takes priority when
  // provided; env var stays as the fallback default for callers that don't
  // pass one. Set once here and reused unchanged by beginAutonomousConversation()
  // below — OpenAI's docs are explicit that voice cannot change once a
  // session has emitted any audio, so there's deliberately no second place
  // this gets resolved.
  const voice     = voiceOverride || process.env.OPENAI_REALTIME_VOICE || 'alloy';

  const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${model}`, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    }
  });

  let ready = false;
  // Queued text waiting to be spoken — either because the WS handshake
  // hasn't finished yet (the greeting's own OpenAI chat-completion call can
  // resolve faster than the Realtime WebSocket connects), or because a
  // previous response is still generating server-side. The latter was a
  // real live-call bug: removing the per-turn merge-grace buffer let the
  // next turn's speak() fire while the previous turn's response.create was
  // still in flight, and the API rejected the second one outright
  // ("conversation_already_has_active_response") — the caller heard
  // nothing for that turn, and the answer was lost rather than replayed.
  // Queuing in both cases and flushing on 'open' / response.done fixes both.
  let pendingSpeakText = null;
  // Counts audio chunks per response — logged on response.done so a silent
  // failure (event names drifting again, audio generated but never
  // forwarded) shows up immediately in the logs as "0 chunks" instead of
  // needing another live call to notice nothing actually played.
  let audioChunksThisResponse = 0;
  // True from when we ask the model to speak until its response finishes —
  // used the same way plivoStreamHandler.js's `isSpeaking` is used today,
  // to distinguish a real barge-in (caller interrupting OUR speech) from
  // ordinary speech-start detection on their own turn.
  let botSpeaking = false;
  // Duration of the most recent detected speech segment (input_audio_buffer.
  // speech_started -> speech_stopped), in ms. Used to catch a real, live
  // failure: a call transcript showed the caller "saying" a plausible short
  // filler ("Sure," "Okay.", "Yes") at moments the caller insists they said
  // nothing at all — gpt-4o-transcribe hallucinating a short, generic word
  // from a near-silent buffer (breathing, line noise, a thinking pause) is a
  // documented failure mode for these models on ambiguous audio, and this
  // file already has one prior hallucination incident on record (mis-
  // transcribing English as Arabic/Hindi/Urdu script on unclear audio).
  // A transcript whose underlying speech segment was only a few hundred ms
  // is far more likely to be that than a real word — VoiceAgent treating it
  // as a genuine (if weak) answer wastes a whole re-ask cycle on a phantom
  // turn the caller never actually took.
  let lastSpeechStartedAtMs = null;
  let lastSpeechDurationMs = null;
  let lastSpeechGapSinceBotAudioMs = null;
  const MIN_SPEECH_MS = 350;
  // DIAGNOSTIC (temporary): a live call had two turns where the caller says
  // they said nothing at all, yet a short transcript ("Yeah"/"Oh") still
  // came through — surviving MIN_SPEECH_MS, so not simple silence. Leading
  // theory: the bot's own voice echoing back down the line is getting
  // detected as caller speech. lastBotAudioChunkAtMs marks the last time we
  // forwarded real (non-cancelled) bot audio to Plivo, so every speech_started
  // can log how soon after that it fired — a near-zero gap right as the bot
  // finishes talking is the signature an echo would leave, versus a real
  // pause before the caller starts their own turn. Note this measures when
  // WE SENT the audio, not when Plivo finished playing it acoustically, so
  // gaps will run a bit short of the true acoustic gap — still comparable
  // call to call. Remove once the hypothesis is confirmed or ruled out.
  let lastBotAudioChunkAtMs = null;
  // True from the moment we send response.cancel until that cancelled
  // response's own response.done confirms it's actually finished. Confirmed
  // on a live call: response.cancel does not stop audio already in flight —
  // a barge-in mid-sentence still logged "Response finished — 21 audio
  // chunks delivered" for the response we'd just cancelled, and those chunks
  // were forwarded to Plivo same as any other, landing on top of whatever
  // played next. The caller heard this as the bot suddenly talking
  // gibberish. Every response.output_audio.delta while this flag is set
  // belongs to a response we've already thrown away, so it's dropped
  // instead of reaching Plivo.
  let responseCancelPending = false;

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
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: `(System: Say this exact text verbatim, word for word, nothing else: "${text}")` }]
      }
    }));
    ws.send(JSON.stringify({ type: 'response.create' }));
  }

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
              eagerness,
              // The API defaults to autonomously generating (and speaking)
              // its own response every time it decides a turn ended — built
              // for a fully autonomous agent. We don't want that: VoiceAgent
              // is the sole decision-maker for what gets said, driven by
              // onTranscript -> agent.processInput() -> speak(). Without
              // this, a live test call showed the session auto-responding
              // to itself in an uncontrolled loop (8 unsolicited responses
              // in ~2 minutes, zero real transcripts in between) — each
              // auto-response's own end apparently re-triggered another.
              create_response: false,
              interrupt_response: false
            },
            // Transcription of the CALLER's own speech is a separate opt-in
            // from turn_detection — without this, the model still
            // "understands" the audio well enough to decide when a turn
            // ends, but never emits a
            // conversation.item.input_audio_transcription.completed event
            // at all, regardless of what's said. A live call showed exactly
            // that: the greeting played fine (that's OUR speak(), unrelated
            // to this), but saying "Yes" or "Who is this?" produced total
            // silence with zero transcript and zero errors, on every call,
            // because nothing was ever configured to transcribe the input.
            // language hints the transcriber instead of leaving it to guess
            // per utterance — added after a live call showed it twice
            // mis-transcribing ordinary English speech as Arabic and Hindi
            // script on unclear audio, in an English-only campaign. That
            // still recurred (Urdu script, twice) even WITH the hint on a
            // later call, so also upgraded from the mini model to the full
            // gpt-4o-transcribe — cost was already accepted as a trade-off
            // for quality earlier in this build.
            transcription: { model: 'gpt-4o-transcribe', language }
          },
          output: {
            format: { type: 'audio/pcmu' },
            voice
          }
        }
      }
    }));
    console.log(`[Realtime] Session opened — model=${model}, voice=${voice}, turn_detection=semantic_vad(eagerness=${eagerness})`);

    if (pendingSpeakText !== null) {
      console.log('[Realtime] Flushing speak() that arrived before the socket was ready');
      flushPendingSpeak();
    }
  });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch (e) {
      return;
    }

    switch (msg.type) {
      // Marks the start of ANY response — including the model's own
      // automatic one in autonomous mode (create_response:true), which is
      // the normal case for every ordinary back-and-forth turn there. Before
      // this, botSpeaking was only ever set true by OUR OWN explicit
      // sendSpeak()/continueConversation() calls, which autonomous mode's
      // regular Q&A turns never go through — the model replies on its own
      // the instant semantic_vad decides the caller's turn is over. That left
      // the new half-duplex sendAudio() gate (see its comment) permanently
      // believing the bot was never speaking during normal conversation, so
      // it never actually withheld anything — confirmed by the user hitting
      // the exact same repeated-question/hallucination symptom immediately
      // after that fix shipped.
      case 'response.created':
        botSpeaking = true;
        break;

      case 'conversation.item.input_audio_transcription.completed': {
        const transcript = msg.transcript?.trim();
        if (transcript) {
          const gapNote = lastSpeechGapSinceBotAudioMs !== null ? `, ${lastSpeechGapSinceBotAudioMs}ms after we last sent bot audio` : '';
          if (lastSpeechDurationMs !== null && lastSpeechDurationMs < MIN_SPEECH_MS) {
            // See MIN_SPEECH_MS comment above — this segment was too short to
            // plausibly be the real word transcribed; treat it as a
            // hallucination and never surface it as a caller turn at all.
            console.log(`[Realtime] Dropping suspected hallucinated transcript "${transcript}" — underlying speech segment was only ${lastSpeechDurationMs}ms${gapNote}`);
          } else {
            console.log(`[Realtime] Transcript (semantic_vad decided turn is complete): "${transcript}" (segment ${lastSpeechDurationMs}ms${gapNote})`);
            handlers.onTranscript(transcript);
          }
        }
        lastSpeechDurationMs = null;
        break;
      }

      // GA renamed this from the beta's bare 'response.audio.delta' to
      // 'response.output_audio.delta' — confirmed against OpenAI's own
      // example code, not just docs prose. This silently broke the whole
      // audio path with NO error event at all: the response was generated
      // successfully, our switch just never matched the event, so nothing
      // ever reached Plivo and the call sat in dead air.
      case 'response.output_audio.delta':
        if (msg.delta && !responseCancelPending) {
          audioChunksThisResponse++;
          lastBotAudioChunkAtMs = Date.now();
          handlers.onAudio?.(Buffer.from(msg.delta, 'base64'));
        }
        break;

      // Autonomous mode only (create_response:true + tools) — the model's
      // own text transcript of what it just SAID, parallel to the audio
      // bytes above. Needed to keep the saved call transcript populated
      // once VoiceAgent.processInput() is no longer in the loop deciding
      // (and thus no longer pushing to chatHistory) for autonomous calls.
      // Event name guessed from the same beta->GA rename pattern already
      // confirmed for response.output_audio.delta — unconfirmed against a
      // live autonomous-mode call, first thing to verify there.
      case 'response.output_audio_transcript.done':
        if (msg.transcript?.trim()) {
          handlers.onAssistantTranscript?.(msg.transcript.trim());
        }
        break;

      // Autonomous mode only — the model called one of the tools declared
      // in beginAutonomousConversation(). Exact event name/shape (arriving
      // alongside audio output in the same response, rather than as the
      // sole content of a text-only response like Chat Completions
      // tool-calling) is unconfirmed against the live API — first thing to
      // verify on a real autonomous-mode call, not an assumption to build on.
      case 'response.function_call_arguments.done': {
        let args = {};
        try { args = JSON.parse(msg.arguments || '{}'); } catch (e) {
          console.error('[Realtime] Tool call arguments were not valid JSON:', msg.arguments);
        }
        console.log(`[Realtime] Tool call: ${msg.name}(${JSON.stringify(args)})`);
        handlers.onToolCall?.(msg.name, args);
        // Acknowledge so the model doesn't stall waiting on a function
        // result — mirrors the function_call_output convention from
        // OpenAI's other tool-calling APIs; not yet confirmed this is
        // required (vs. optional) for the Realtime API specifically.
        if (msg.call_id) {
          ws.send(JSON.stringify({
            type: 'conversation.item.create',
            item: { type: 'function_call_output', call_id: msg.call_id, output: 'ok' }
          }));
        }
        break;
      }

      case 'input_audio_buffer.speech_started':
        // Fires on ANY detected speech, independent of whether it's a real
        // barge-in — used to reset the call-level silence timeout so a
        // caller mid-answer never gets timed out just because their
        // transcript hasn't come back yet (semantic_vad can legitimately
        // take a while on a long, natural answer).
        handlers.onSpeechActivity?.();
        lastSpeechStartedAtMs = typeof msg.audio_start_ms === 'number' ? msg.audio_start_ms : Date.now();
        lastSpeechGapSinceBotAudioMs = lastBotAudioChunkAtMs !== null ? Date.now() - lastBotAudioChunkAtMs : null;
        console.log(`[Realtime][diag] speech_started — botSpeaking=${botSpeaking}, ${lastSpeechGapSinceBotAudioMs !== null ? `${lastSpeechGapSinceBotAudioMs}ms since we last sent bot audio to Plivo` : 'bot has not spoken yet this call'}`);
        // sendAudio() now withholds caller audio entirely while botSpeaking is
        // true (deliberate half-duplex trade-off — see its comment), so this
        // branch should be unreachable in normal operation; kept as cheap
        // insurance for the tiny race where a frame sent right as botSpeaking
        // flips true still reaches OpenAI before sendAudio's check took effect.
        if (botSpeaking) {
          console.log('[Realtime] Caller started speaking while bot was talking — barge-in, cancelling in-flight response');
          // clearAudio (sent by the caller of this handler) only stops
          // Plivo from PLAYING what's already been sent — it does nothing
          // to stop the model from continuing to GENERATE that response
          // server-side. interrupt_response:false means the API won't do
          // this automatically either (that setting only concerns its own
          // auto-created responses, unrelated to this). Without an explicit
          // cancel, more audio for the same stale response keeps arriving
          // and gets queued right back into Plivo's buffer, which can start
          // playing again over whatever the caller says next — a second,
          // confusing interruption that has nothing to do with them.
          ws.send(JSON.stringify({ type: 'response.cancel' }));
          responseCancelPending = true;
          botSpeaking = false;
          handlers.onSpeechStart?.();
        }
        break;

      case 'input_audio_buffer.speech_stopped': {
        const endedAtMs = typeof msg.audio_end_ms === 'number' ? msg.audio_end_ms : Date.now();
        lastSpeechDurationMs = lastSpeechStartedAtMs !== null ? endedAtMs - lastSpeechStartedAtMs : null;
        console.log(`[Realtime][diag] speech_stopped — segment duration=${lastSpeechDurationMs}ms`);
        break;
      }

      case 'response.done': {
        botSpeaking = false;
        if (responseCancelPending) {
          // This is the cancelled response's own response.done — any audio
          // for it was already dropped above, so there's nothing real to
          // report. Treating it like a normal (possibly zero-audio) response
          // would misfire the "nothing was spoken, prompt a continuation"
          // path for a turn we deliberately threw away, not one that
          // actually produced nothing.
          responseCancelPending = false;
          audioChunksThisResponse = 0;
          flushPendingSpeak();
          break;
        }
        const hadAudio = audioChunksThisResponse > 0;
        if (!hadAudio) {
          // Confirmed on a live autonomous-mode call: a response whose ONLY
          // content is a tool call (e.g. answer_captured) delivers zero
          // audio — the model doesn't automatically also speak the next
          // question in the same turn. Without an explicit follow-up
          // response.create, nothing ever prompts it to continue, and the
          // call goes silent waiting for a caller turn that was never
          // coming. handlers.onResponseDone(hadAudio) lets the caller decide
          // whether to prompt a continuation.
          console.warn('[Realtime] Response completed with ZERO audio chunks delivered — nothing was spoken. Check for an event-name mismatch or a text-only response.');
        } else {
          console.log(`[Realtime] Response finished — ${audioChunksThisResponse} audio chunks delivered`);
        }
        audioChunksThisResponse = 0;
        handlers.onResponseDone?.(hadAudio);
        flushPendingSpeak();
        break;
      }

      case 'error':
        console.error('[Realtime] Server error:', JSON.stringify(msg.error || msg));
        // A rejected response.create (e.g. "conversation_already_has_active_
        // response") leaves botSpeaking stuck true with no response.done ever
        // coming for the failed attempt, since it never actually started —
        // without this, every future speak() would queue behind a response
        // that doesn't exist and never get spoken for the rest of the call.
        // speak() now checks botSpeaking before sending (see below) so this
        // shouldn't be reachable from our own code anymore, but recovering
        // here is cheap insurance against wedging the call silent.
        if (msg.error?.code === 'conversation_already_has_active_response' && botSpeaking) {
          botSpeaking = false;
          flushPendingSpeak();
        }
        // A cancel we sent can itself be rejected (confirmed on a live call:
        // "response_cancel_not_active" — nothing was active to cancel,
        // typically because it had already finished by the time our cancel
        // arrived). When that happens, no response.done is ever coming for
        // a "cancelled" response that never existed, so the audio-dropping
        // guard above would otherwise stay stuck on for the rest of the
        // call, silently swallowing every future response's audio —
        // including the eventual sign-off. Clear it here instead.
        if (msg.error?.code === 'response_cancel_not_active' && responseCancelPending) {
          responseCancelPending = false;
        }
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
      // Half-duplex by design: never forward caller audio to OpenAI while the
      // bot itself is talking, so its VAD has nothing to mishear the bot's own
      // voice/line-echo as caller speech from in the first place — this is a
      // stronger guarantee than filtering the result afterward (MIN_SPEECH_MS
      // above), since the audio never reaches OpenAI's turn-detection at all.
      // Trade-off accepted deliberately: a caller can no longer barge in
      // mid-sentence — only speech that arrives once botSpeaking has gone
      // back to false is heard at all. Listening resumes the instant it does.
      if (botSpeaking) return;
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
      if (!ready || ws.readyState !== WebSocket.OPEN) {
        console.log('[Realtime] speak() called before the socket was ready — queuing until it opens');
        pendingSpeakText = text;
        return;
      }
      if (botSpeaking) {
        // A previous response is still generating — sending response.create
        // now would get rejected outright by the API (confirmed on a live
        // call: "conversation_already_has_active_response"), silently
        // dropping this turn's reply. Queue it and flush on response.done
        // instead of losing it.
        console.log('[Realtime] speak() called while a previous response is still in flight — queuing until it finishes');
        pendingSpeakText = text;
        return;
      }
      sendSpeak(text);
    },

    /**
     * Force the given verbatim text NOW, cancelling whatever the model might
     * still be generating for the current turn first. Two callers: the
     * autonomous mode's closing line (end_call should always speak the
     * campaign's configured sign-off, not whatever the model was mid-sentence
     * composing) and plivoStreamHandler.js's stall-recovery valve (forcing
     * the next question's text when the model isn't making progress). The
     * log below used to say "the configured closing line" unconditionally,
     * which was actively misleading while diagnosing a live call where THIS
     * was the stall valve cutting off a mid-sentence reply, not a sign-off.
     */
    interruptAndSpeak(text) {
      if (botSpeaking) {
        console.log(`[Realtime] Cancelling in-flight response to force: "${text}"`);
        if (ready && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'response.cancel' }));
          responseCancelPending = true;
        }
        botSpeaking = false;
      }
      this.speak(text);
    },

    /**
     * Prompt the model to continue speaking when a turn ended with a tool
     * call (answer_captured/skip_to_question) but no accompanying speech —
     * confirmed on a live call that this genuinely happens, and nothing else
     * triggers a new response until the caller speaks again, which leaves
     * the call silently stuck. Only call this once response.done has fired
     * (botSpeaking false) for the response that carried the tool call —
     * calling it while a response is still active would hit the same
     * "conversation_already_has_active_response" rejection speak() already
     * guards against elsewhere.
     */
    continueConversation() {
      if (!ready || ws.readyState !== WebSocket.OPEN || botSpeaking) return;
      console.log('[Realtime] Prompting the model to continue — previous turn ended with a tool call and no speech');
      botSpeaking = true;
      ws.send(JSON.stringify({ type: 'response.create' }));
    },

    /**
     * Switch a session from the forced-verbatim greeting into free-flowing
     * autonomous conversation: create_response:true (the model replies on
     * its own the instant semantic_vad decides a turn is over, same as
     * ChatGPT Voice Mode) plus the tool-calling contract for order/logic
     * tracking. Sent as a follow-up session.update once the greeting's own
     * response.done has fired — never called before the socket is ready,
     * since it can only happen after a session already exists.
     */
    beginAutonomousConversation(newInstructions, tools) {
      if (!ready || ws.readyState !== WebSocket.OPEN) {
        console.warn('[Realtime] beginAutonomousConversation called before the socket was ready — ignoring');
        return;
      }
      console.log('[Realtime] Switching to autonomous conversation mode (create_response=true, tools enabled)');
      ws.send(JSON.stringify({
        type: 'session.update',
        session: {
          type: 'realtime',
          instructions: newInstructions,
          tools,
          tool_choice: 'auto',
          audio: {
            input: {
              format: { type: 'audio/pcmu' },
              turn_detection: {
                type: 'semantic_vad',
                eagerness,
                create_response: true,
                // Keep manual barge-in handling (clearAudio + explicit
                // response.cancel above) as the sole mechanism, same as the
                // scripted phase — avoids two different cancellation paths
                // racing each other.
                interrupt_response: false
              },
              transcription: { model: 'gpt-4o-transcribe', language }
            },
            output: {
              format: { type: 'audio/pcmu' },
              voice
            }
          }
        }
      }));
    },

    close() {
      try { ws.close(); } catch (e) {}
    }
  };
}
