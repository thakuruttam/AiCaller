import WebSocket, { WebSocketServer } from 'ws';
import { VoiceAgent } from './VoiceAgent.js';
import { prisma } from './db.js';
import twilio from 'twilio';
import { publishEvaluation } from './queues/ingestQueue.js';
import { redis } from './redis.js';
import { setupSTT } from './providers/stt.js';
import { speakBackToTwilio, DeepgramTTSSocket } from './providers/tts.js';

export function setupTwilioStream(server) {
  const wss = new WebSocketServer({ server, path: '/streams' });

  wss.on('connection', async (ws) => {
    console.log('[Stream] Twilio connected via WebSocket');
    
    let streamSid = null;
    let agent = null;
    let sttStream = null;
    let ttsSocket = null;     // persistent Deepgram TTS WebSocket, opened on call start
    let isSpeaking = false;
    let callLogId = null;
    let callSid = null;
    let transcriptSaved = false;
    let isCallEnding = false;
    let currentCampaign = null;
    let currentCallLog = null;
    let campaignContact = null;
    
    let silenceTimeout = null;
    const timeoutSeconds = parseInt(process.env.VOICE_TIMEOUT_SECONDS || '60', 10);

    // Transcript accumulation buffer — merges multiple Deepgram finals that arrive
    // within TRANSCRIPT_BUFFER_MS of each other into one coherent user turn before
    // the agent processes it. Prevents mid-sentence STT cuts from being treated as
    // complete answers and assigning speech to the wrong question.
    let transcriptAccumulator = '';
    let transcriptTimer = null;
    const TRANSCRIPT_BUFFER_MS = parseInt(process.env.TRANSCRIPT_BUFFER_MS || '200', 10);

    // Buffer for user speech that arrives WHILE the bot is speaking (isSpeaking=true).
    // Rather than dropping it, we accumulate it and replay once TTS ends.
    // This eliminates the freeze where the user says "yes" during the greeting
    // and the bot sits silent for 15 seconds waiting for the no-answer timer.
    let pendingTranscript = '';

    // Set to true when UtteranceEnd fires while isSpeaking. Signals that the buffered
    // speech is complete and should be flushed immediately (not via 200ms timer) once
    // TTS finishes. This makes barge-in answers process as fast as non-barge-in ones.
    let pendingUtteranceEnd = false;

    // Set to true when the user interrupts the bot (barge-in). The stale end_of_tts
    // mark that Twilio may still fire after a `clear` is ignored so it doesn't
    // re-trigger post-TTS logic (asking the next question, etc.).
    let bargedIn = false;

    // Deduplication guard: Deepgram sometimes fires a delayed second final for the
    // same utterance (e.g. once during TTS → pendingTranscript, then again after TTS
    // ends as a late delivery). Without this guard the stale second final enters
    // pendingTranscript and gets replayed on the NEXT mark, causing every question
    // to be asked twice. We track the last flushed text + timestamp and drop any
    // transcript that exactly matches it within a 5-second dedup window.
    let lastFlushedTranscript = '';
    let lastFlushedTime = 0;

    // Per-question no-answer retry: if user is completely silent for NO_ANSWER_SECONDS,
    // ask "are you still there?" once. After 1 retry (total ~20s of silence), skip to
    // the next question rather than hanging up — the call continues.
    let noAnswerTimer = null;
    let noAnswerRetries = 0;
    let noAnswerTimerActive = false; // guard: stays false after clearTimeout on already-fired timer
    const NO_ANSWER_SECONDS = parseInt(process.env.NO_ANSWER_SECONDS || '10', 10);
    const NO_ANSWER_MAX_RETRIES = parseInt(process.env.NO_ANSWER_MAX_RETRIES || '1', 10);

    // Hard 40-second cap per question/answer cycle.
    // Starts when TTS finishes playing a question. Cancels as soon as flushTranscript
    // successfully processes an answer. If it fires while the user is mid-speech, flush
    // whatever is accumulated and move on. Prevents any single question from blocking
    // the call for more than MAX_ANSWER_SECONDS.
    let maxAnswerTimer = null;
    const MAX_ANSWER_SECONDS = parseInt(process.env.MAX_ANSWER_SECONDS || '40', 10);

    function clearMaxAnswerTimer() {
      if (maxAnswerTimer) { clearTimeout(maxAnswerTimer); maxAnswerTimer = null; }
    }

    function startMaxAnswerTimer() {
      clearMaxAnswerTimer();
      if (!agent?.expectsUserReply) return; // only for questions, not information items

      maxAnswerTimer = setTimeout(async () => {
        maxAnswerTimer = null;
        if (isCallEnding || !agent || agent.done) return;
        if (isSpeaking || isFlushingTranscript) return; // don't interrupt active TTS or processing
        console.log(`[Stream] Max answer time (${MAX_ANSWER_SECONDS}s) reached — forcing advance`);

        clearNoAnswerTimer();

        // If there's accumulated speech, process it as-is
        if (transcriptAccumulator.trim()) {
          if (transcriptTimer) { clearTimeout(transcriptTimer); transcriptTimer = null; }
          console.log(`[Stream] Flushing partial transcript on max-answer timeout: "${transcriptAccumulator}"`);
          await flushTranscript();
          return;
        }

        // Nothing spoken — advance state machine properly via continueWithoutUser()
        // so _buildNextDirective() is called with the real next question text.
        if (isFlushingTranscript) return;
        const reply = await agent.continueWithoutUser();
        if (callSid) await agent.saveState(redis, callSid);
        if (agent.shouldHangUp) isCallEnding = true;
        if (reply && reply.length > 0) {
          isSpeaking = true;
          const ok = await speakBackToTwilio(ws, streamSid, reply, campaignLanguage, ttsSocket);
          if (!ok) isSpeaking = false;
        }
      }, MAX_ANSWER_SECONDS * 1000);
    }

    // Prevents two concurrent flushTranscript calls from both calling processInput
    let isFlushingTranscript = false;

    function clearNoAnswerTimer() {
      if (noAnswerTimer) clearTimeout(noAnswerTimer);
      noAnswerTimerActive = false; // cancels in-flight async callback even after timer fired
    }

    function startNoAnswerTimer() {
      clearNoAnswerTimer();
      // Only wait for a reply after questions — not after instructions/information
      if (!agent?.expectsUserReply) return;

      noAnswerTimerActive = true;
      noAnswerTimer = setTimeout(async () => {
        if (!noAnswerTimerActive || isCallEnding || isSpeaking || isFlushingTranscript || !agent || !agent.expectsUserReply) return;

        noAnswerRetries++;
        console.log(`[Stream] No answer for ${NO_ANSWER_SECONDS}s. Retry ${noAnswerRetries}/${NO_ANSWER_MAX_RETRIES}`);

        let reply;
        if (noAnswerRetries <= NO_ANSWER_MAX_RETRIES) {
          // Look up the exact text of the question that was most recently asked
          // (currentIndex already advanced, so the last asked question is at currentIndex - 1)
          const lastAskedIdx = agent.currentIndex - 1;
          const lastAskedItem = agent.items[lastAskedIdx];
          const exactText = lastAskedItem?.text
            ? lastAskedItem.text.replace(/\[([^\]]+)\]/g, '$1')
            : null;

          let directive;
          if (exactText && (lastAskedItem?.itemType || 'question') === 'question') {
            // Inject the exact question text so the LLM cannot rephrase it
            directive = `(System: The user has not responded. Say "Are you still there?" and then immediately repeat this exact question word for word: "${exactText}". Do NOT change a single word.)`;
          } else {
            // No question text available (e.g. call is at closure) — just check in
            directive = `(System: The user has not responded. Ask "Are you still there?" and wait.)`;
          }
          reply = await agent.processInput(directive);
        } else {
          noAnswerRetries = 0;
          // Retries exhausted — advance the state machine via continueWithoutUser() so
          // _buildNextDirective() is called with the real next question. Using a vague
          // system-directive skip caused two bugs: (1) currentIndex never advanced,
          // so subsequent no-answer cycles re-asked the same question in a loop, and
          // (2) the LLM hallucinated questions when told to "ask the next one" without
          // being given the actual next question text.
          reply = await agent.continueWithoutUser();
        }

        // User spoke or call ended during the LLM call — discard this stale response
        if (!noAnswerTimerActive || isCallEnding) {
          console.log('[Stream] No-answer timer response discarded — user answered or call already ending');
          return;
        }

        if (callSid) await agent.saveState(redis, callSid);
        if (agent.shouldHangUp) isCallEnding = true;

        if (reply && reply.length > 0) {
          isSpeaking = true;
          const ok = await speakBackToTwilio(ws, streamSid, reply, campaignLanguage, ttsSocket);
          if (!ok) isSpeaking = false;
          // Success: end_of_tts handles startNoAnswerTimer at the right time
        }
      }, NO_ANSWER_SECONDS * 1000);
    }

    /** After instruction-only TTS, advance to the next scripted segment without waiting. */
    async function autoAdvanceScript() {
      if (!agent || isCallEnding || isSpeaking || agent.expectsUserReply) return;

      const reply = await agent.continueWithoutUser();
      if (callSid) await agent.saveState(redis, callSid);
      if (agent.shouldHangUp) isCallEnding = true;

      if (reply && reply.length > 0) {
        isSpeaking = true;
        const ok = await speakBackToTwilio(ws, streamSid, reply, campaignLanguage, ttsSocket);
        if (!ok) isSpeaking = false;
        // Success: end_of_tts handles startNoAnswerTimer at the right time
      } else if (isCallEnding) {
        try {
          const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          await client.calls(callSid).update({ status: 'completed' });
        } catch (e) {
          console.error('[Stream] Failed to hang up via API:', e.message);
        }
      }
    }


    function clearSilenceTimeout() {
      if (silenceTimeout) clearTimeout(silenceTimeout);
    }

    function resetSilenceTimeout() {
      clearSilenceTimeout();
      silenceTimeout = setTimeout(async () => {
        if (isCallEnding || !callSid) return;
        console.log(`[Stream] Silence timeout reached (${timeoutSeconds}s). Ending call ${callSid}`);
        isCallEnding = true;
        try {
           const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
           await client.calls(callSid).update({ status: 'completed' });
        } catch (e) {
           console.error("[Stream] Failed to hang up via API on timeout:", e.message);
        }
      }, timeoutSeconds * 1000);
    }

    async function saveTranscript() {
      if (transcriptSaved) return;
      transcriptSaved = true;

      // Clear Redis state — call is over, no longer needed
      if (callSid) await VoiceAgent.clearState(redis, callSid);

      // Finalize call log status — if the call-worker timer was lost (container restart
      // or error), the status stays stuck at in-progress forever. The stream ending is the
      // authoritative signal that the call is over, so close it out here.
      if (callLogId) {
        try {
          const current = await prisma.callLog.findUnique({ where: { id: callLogId }, select: { status: true } });
          if (current?.status === 'in-progress') {
            await prisma.callLog.update({ where: { id: callLogId }, data: { status: 'completed' } });
            console.log(`[Stream] Finalized callLog ${callLogId} status → completed`);
          }
        } catch (e) {
          console.warn('[Stream] Could not finalize callLog status:', e.message);
        }
      }

      try {
        const history = agent?.getHistory().filter(msg => msg.role !== 'system') || [];
        
        // Prepend the Twilio SID so that recordings can be found later
        const header = callSid ? `[Twilio_SID:${callSid}]\n\n` : '';
        const formattedTranscript = history.length > 0 
          ? header + history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
          : header + '[No speech detected]';
        
        if (callLogId && history.length > 0) {
          await prisma.callLog.update({
            where: { id: callLogId },
            data: { transcript: formattedTranscript }
          });
          console.log(`[Stream] Successfully saved transcript (${history.length} messages) for ${callLogId}`);
        }

        // Queue report evaluation via singleton (no new Queue per call)
        console.log(`[Stream] Queueing eval... callLogId: ${callLogId}, currentCampaign exists: ${!!currentCampaign}`);
        if (callLogId && currentCampaign) {
          try {
            await publishEvaluation(currentCampaign.tenantId, {
              callLogId,
              campaignId:        currentCampaign.id,
              tenantId:          currentCampaign.tenantId,
              contactName:       campaignContact?.overrides?.name || currentCallLog?.contact?.name,
              transcript:        formattedTranscript,
              campaignName:      currentCampaign.name,
              dataToCollect:     currentCampaign.dataToCollect ?? [],
              reportWebhook:     currentCampaign.callSettings?.reportWebhook ?? null,
              identityConfirmed: agent?.identityConfirmed ?? null
            });
            console.log(`[Stream] Queued CALL_COMPLETED for ${callLogId} in report.ingest`);
          } catch (err) {
            console.error(`[Stream] Failed to queue evaluation report:`, err);
          }
        }
      } catch (e) {
         console.error('[Stream] Failed to save transcript for', callLogId, e.message);
      }
    }

    // Barge-in: user started speaking while bot is talking.
    // Send a Twilio `clear` to drain the audio buffer immediately so the bot
    // stops speaking, then flip isSpeaking so the transcript goes straight to
    // the accumulator instead of pendingTranscript.
    const handleSpeechStart = () => {
      if (!isSpeaking) return;
      console.log('[Stream] Barge-in: user interrupted bot — sending clear');
      bargedIn  = true;
      isSpeaking = false;
      if (ws.readyState === ws.OPEN && streamSid) {
        ws.send(JSON.stringify({ event: 'clear', streamSid }));
      }
      // Discard stale pending state from the interrupted TTS turn
      pendingTranscript    = '';
      pendingUtteranceEnd  = false;
      clearMaxAnswerTimer();
      clearNoAnswerTimer();
    };

    // 1. Setup STT Provider (Deferred until 'start' event when language is known)
    let campaignLanguage = 'English'; // will be updated when campaign loads

    // Flush accumulated transcript to the agent
    const flushTranscript = async () => {
      const fullTranscript = transcriptAccumulator.trim();
      transcriptAccumulator = '';
      transcriptTimer = null;
      if (!fullTranscript || !agent || isCallEnding) return;

      // Prevent two concurrent processInput calls.
      // If user speaks while the LLM is thinking, the late Deepgram final is dropped:
      // the bot is about to ask the next question, so the user's answer to THAT question
      // will arrive after it's spoken. Re-queuing (vs dropping) caused the same transcript
      // to be processed twice — advancing the state machine by 2 questions instead of 1.
      if (isFlushingTranscript) {
        console.log(`[STT] Agent busy — dropping concurrent transcript: "${fullTranscript}"`);
        return;
      }

      isFlushingTranscript = true;

      // Record what we're about to process so handleTranscript can dedup late Deepgram finals
      lastFlushedTranscript = fullTranscript;
      lastFlushedTime = Date.now();

      console.log(`[STT] Processing turn: "${fullTranscript}"`);

      let reply;
      try {
        reply = await agent.processInput(fullTranscript);
      } catch (e) {
        console.error('[Stream] Uncaught error from agent.processInput — bot would have frozen:', e.message);
        isFlushingTranscript = false;
        // Restart the no-answer timer so the call can self-recover rather than freezing silently
        if (agent?.expectsUserReply) startNoAnswerTimer();
        return;
      }

      isFlushingTranscript = false;

      // Answer was processed — cancel the 40s hard cap and reset retry counter for this question
      clearMaxAnswerTimer();
      noAnswerRetries = 0;

      if (callSid) await agent.saveState(redis, callSid);
      if (agent.shouldHangUp) isCallEnding = true;
      console.log(`[Agent] Reply: ${reply}`);

      if (reply && reply.length > 0) {
        isSpeaking = true;
        const success = await speakBackToTwilio(ws, streamSid, reply, campaignLanguage, ttsSocket);
        if (!success) {
          isSpeaking = false;
          if (isCallEnding && callSid) {
            // TTS failed on the sign-off — hang up directly so the call doesn't stay open
            console.warn('[Stream] TTS failed on sign-off turn — hanging up directly');
            try {
              const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
              await client.calls(callSid).update({ status: 'completed' });
            } catch (e) {
              console.error('[Stream] Hangup after TTS failure:', e.message);
            }
          } else {
            console.warn('[Stream] speakBackToTwilio returned false — restarting no-answer timer');
            if (agent.expectsUserReply) startNoAnswerTimer();
          }
        }
        // Success: end_of_tts mark will fire once Twilio plays the audio — that's when we start the timer
      } else if (isCallEnding) {
        console.log(`[Stream] No TTS needed. Executing final hangup for ${callSid}!`);
        try {
          const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
          await client.calls(callSid).update({ status: 'completed' });
        } catch (e) {
          console.error("[Stream] Failed to hang up via API:", e.message);
        }
      }
    };

    // STT callback — accumulates consecutive finals within TRANSCRIPT_BUFFER_MS
    // before passing the full turn to the agent. This prevents a 700ms natural
    // pause mid-sentence from being treated as end-of-turn.
    const handleTranscript = (transcript) => {
      console.log(`[STT] Final fragment: "${transcript}"`);

      // ── Deduplication guard ──────────────────────────────────────────────────
      // Deepgram can fire a delayed second final for the same utterance after we
      // already processed it (once via pendingTranscript replay, then again as a
      // late STT delivery). Drop it if it exactly matches the last flushed text
      // within a 5-second window to prevent every turn being processed twice.
      const trimmed = transcript.trim();
      if (
        trimmed.length > 0 &&
        trimmed === lastFlushedTranscript &&
        Date.now() - lastFlushedTime < 5000
      ) {
        console.log(`[STT] Dropped duplicate transcript (already processed): "${trimmed}"`);
        return;
      }
      // ────────────────────────────────────────────────────────────────────────

      clearNoAnswerTimer();
      // Don't clear maxAnswerTimer here — it stays running while the user speaks.
      // It is only cancelled in flushTranscript when the answer is fully processed.
      resetSilenceTimeout();

      // If the bot is currently speaking, buffer the transcript instead of processing
      // it immediately. It will be replayed once the mark/end_of_tts event fires.
      if (isSpeaking) {
        pendingTranscript = pendingTranscript
          ? `${pendingTranscript} ${transcript}`
          : transcript;
        console.log(`[STT] Bot is speaking — buffered pending transcript: "${pendingTranscript}"`);
        return;
      }

      // Append this fragment to the accumulator
      transcriptAccumulator = transcriptAccumulator
        ? `${transcriptAccumulator} ${transcript}`
        : transcript;

      // (Re)start the flush timer as a fallback — fires if UtteranceEnd never arrives
      // (e.g. single-word answers like "yes" where Deepgram may not emit UtteranceEnd)
      if (transcriptTimer) clearTimeout(transcriptTimer);
      transcriptTimer = setTimeout(flushTranscript, TRANSCRIPT_BUFFER_MS);
    };

    // Deepgram UtteranceEnd: fires after utterance_end_ms of silence with no new words.
    // This is the authoritative end-of-turn signal — flush immediately instead of waiting
    // for the 200ms fallback timer. Gives us fast condition evaluation (skip/end-call).
    const handleUtteranceEnd = () => {
      if (isCallEnding || !agent) return;

      if (isSpeaking) {
        // User spoke during TTS — mark the pending speech as complete so the end_of_tts
        // handler knows to flush immediately rather than starting the 200ms timer.
        pendingUtteranceEnd = true;
        console.log('[STT] UtteranceEnd during TTS — will flush pending transcript immediately on end_of_tts');
        return;
      }

      // Cancel the 200ms fallback timer and flush right now
      if (transcriptTimer) { clearTimeout(transcriptTimer); transcriptTimer = null; }
      if (transcriptAccumulator.trim()) {
        console.log('[STT] UtteranceEnd — flushing immediately');
        flushTranscript();
      }
    };


    ws.on('message', async (message) => {
      let msg;
      try {
        msg = JSON.parse(message);
      } catch (e) {
        return;
      }
      
      switch (msg.event) {
        case 'connected':
          console.log('[Stream] Twilio Handshake Successful');
          break;
        case 'start':
          streamSid = msg.start.streamSid;
          const { campaignId, callLogId: parsedCallLogId } = msg.start.customParameters || {};
          callLogId = parsedCallLogId;
          callSid = msg.start.callSid; // Twilio native property
          
          console.log(`[Stream] Started: ${streamSid} (Call SID: ${callSid}) for Campaign: ${campaignId}`);
          
          // Also save SID here as a redundant measure
          if (callLogId && callSid) {
            try {
              await prisma.callLog.update({
                where: { id: callLogId },
                data: { providerRef: callSid }
              });
            } catch (e) {
              console.warn('[Stream] Could not save providerRef (stale callLogId?):', e.message);
            }
          }
          
          resetSilenceTimeout();
          
          // Fetch campaign, call log, and per-contact overrides
          const [campaign, callLog] = await Promise.all([
            prisma.campaign.findUnique({
              where: { id: campaignId },
              select: {
                id: true,
                name: true,
                tenantId: true,
                rules: true,
                callSettings: true,
                dataToCollect: true,
                endCallIf: true,
                callModule: {
                  select: {
                    goal: true,
                    callIntro: true,
                    callSignOff: true,
                    successCriteria: true
                  }
                }
              }
            }),
            prisma.callLog.findUnique({
              where: { id: callLogId },
              include: { contact: true }
            })
          ]);
          
          currentCampaign = campaign;
          currentCallLog = callLog;
          
          if (campaign && callLog) {
            // Resolve campaign language (set in Step 6 Call Settings in UI)
            campaignLanguage = campaign.callSettings?.language || 'English';
            console.log(`[Stream] Campaign language: ${campaignLanguage}`);

            // Open persistent Deepgram TTS WebSocket for English calls — eliminates
            // the ~150ms HTTPS reconnection overhead on every agent turn.
            if (campaignLanguage === 'English') {
              ttsSocket = new DeepgramTTSSocket();
            }

            // Initialize STT provider with the correct language
            if (sttStream) {
              sttStream.close();
            }
            sttStream = setupSTT(campaignLanguage, {
              onTranscript:    handleTranscript,
              onUtteranceEnd:  handleUtteranceEnd,
              onSpeechStart:   handleSpeechStart,
              onError: (err) => console.error('[STT] Error:', err),
              onClose: () => console.log('[STT] Closed')
            });
            campaignContact = await prisma.campaignContact.findFirst({
              where: {
                campaignId: campaign.id,
                contactId: callLog.contactId
              }
            });

            const overrides = campaignContact?.overrides || {};
            
            // Merge strategy: Contact overrides take precedence over campaign defaults
            const finalGoals = {
              goal: overrides.goals?.goal || campaign.callModule?.goal,
              callIntro: overrides.goals?.callIntro || campaign.callModule?.callIntro,
              callSignOff: overrides.goals?.callSignOff || campaign.callModule?.callSignOff
            };

            const finalQuestions = overrides.dataToCollect || campaign.dataToCollect || [];

            agent = new VoiceAgent({
              name: campaign.name,
              contactName: overrides.name || callLog.contact?.name,
              goal: finalGoals.goal,
              callIntro: finalGoals.callIntro,
              callSignOff: finalGoals.callSignOff,
              dataToCollect: finalQuestions,
              endCallIf: campaign.endCallIf,
              successCriteria: campaign.callModule?.successCriteria,
              language: campaignLanguage  // ← from campaign callSettings UI
            });
            
            // Initial greeting using the specific intro
            let processedIntro = finalGoals.callIntro || 'Hello, this is an AI assistant calling.';
            if (agent.contactName) {
              processedIntro = processedIntro.replace(/\[Name\]/gi, agent.contactName);
              
              // Ensure the greeting always asks for identity confirmation
              const introLower = processedIntro.toLowerCase();
              if (!introLower.includes('speaking with') && !introLower.includes('is this') && !introLower.includes('are you')) {
                processedIntro = processedIntro.trim();
                if (!processedIntro.endsWith('?') && !processedIntro.endsWith('.')) processedIntro += '.';
                processedIntro += ` Am I speaking with ${agent.contactName}?`;
              }
            }

            // Build the language-specific greeting directive
            const langDirective = campaignLanguage !== 'English'
              ? ` Speak in ${campaignLanguage}. Deliver this greeting translated naturally into ${campaignLanguage}, keeping the meaning identical and adding no extra content.`
              : '';
            const greeting = await agent.processInput(`(System: The call has just been connected. Say this EXACT introduction to the user word for word: "${processedIntro}".${langDirective} Do NOT add any extra sentences or questions beyond what is written.)`);
            console.log(`[Agent] Greeting: ${greeting}`);
            if (greeting && greeting.length > 0) {
              isSpeaking = true;
              const ok = await speakBackToTwilio(ws, streamSid, greeting, campaignLanguage, ttsSocket);
              if (!ok) isSpeaking = false;
              else if (agent.expectsUserReply) startNoAnswerTimer();
            } else {
              console.warn('[Agent] Greeting was empty after sanitization — check callIntro config or LLM response.');
            }
          }
          break;

        case 'media':
          // Pipe raw mu-law audio to STT Provider.
          // Even while isSpeaking we still forward audio so Deepgram can detect
          // end-of-utterance and give us the transcript — we just hold the result
          // in pendingTranscript and process it once TTS finishes.
          if (sttStream) {
            const audioPayload = Buffer.from(msg.media.payload, 'base64');
            sttStream.sendAudio(audioPayload);
          }
          break;

        case 'mark':
          if (msg.mark?.name === 'end_of_tts') {
            // If the user already interrupted (barge-in), this mark is stale — the
            // audio was cleared via `clear` and we're already in listening mode.
            // Don't wipe the accumulator or re-trigger post-TTS script logic.
            if (bargedIn) {
              bargedIn = false;
              resetSilenceTimeout();
              console.log('[Stream] Stale end_of_tts after barge-in — ignored');
              // Must still hang up if the sign-off was playing when user interrupted
              if (isCallEnding && callSid) {
                try {
                  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                  await client.calls(callSid).update({ status: 'completed' });
                } catch (e) {
                  console.error('[Stream] Hangup failed after barge-in:', e.message);
                }
              }
              break;
            }

            isSpeaking = false; // Release the lock so the bot can listen again
            // Clear any mid-speaking STT accumulator fragments (echo/noise during TTS)
            if (transcriptTimer) { clearTimeout(transcriptTimer); transcriptTimer = null; }
            transcriptAccumulator = '';

            // If the user already replied while we were speaking, process that reply
            // now instead of waiting 15 s for the no-answer timer.
            if (pendingTranscript && !isCallEnding && agent) {
              const captured = pendingTranscript;
              const utteranceWasComplete = pendingUtteranceEnd;
              pendingTranscript = '';
              pendingUtteranceEnd = false;

              if (utteranceWasComplete) {
                // UtteranceEnd already fired during TTS — the user's turn is definitively
                // complete. Inject directly into the accumulator and flush immediately
                // (no 200ms timer) so skip/end-call conditions fire as fast as possible.
                console.log(`[Stream] Flushing barge-in immediately (UtteranceEnd confirmed): "${captured}"`);
                transcriptAccumulator = captured;
                flushTranscript();
              } else {
                // UtteranceEnd hasn't fired yet — start the normal accumulation timer
                console.log(`[Stream] Replaying pending transcript captured during TTS: "${captured}"`);
                handleTranscript(captured);
              }
              break; // skip the normal post-TTS branching below
            }
            pendingUtteranceEnd = false;

            if (isCallEnding) {
              console.log(`[Stream] TTS finished playing out loud. Executing final hangup for ${callSid}!`);
              try {
                 const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                 await client.calls(callSid).update({ status: 'completed' });
              } catch (e) {
                 console.error("[Stream] Failed to hang up via API:", e.message);
              }
            } else if (agent && !agent.expectsUserReply && !agent.done) {
              // Instruction-only segment finished — continue script without waiting
              resetSilenceTimeout();
              await autoAdvanceScript();
            } else {
              resetSilenceTimeout();
              if (agent?.expectsUserReply) {
                startNoAnswerTimer();
                startMaxAnswerTimer(); // 40s hard cap starts when question finishes playing
              }
            }
          }
          break;

        case 'stop':
          console.log('[Stream] Stopped');
          clearSilenceTimeout();
          clearNoAnswerTimer();
          clearMaxAnswerTimer();
          if (sttStream) sttStream.close();
          if (ttsSocket) { ttsSocket.close(); ttsSocket = null; }
          saveTranscript();
          break;
      }
    });

    ws.on('close', () => {
      console.log('[Stream] Client disconnected');
      clearSilenceTimeout();
      clearNoAnswerTimer();
      clearMaxAnswerTimer();
      if (sttStream) sttStream.close();
      if (ttsSocket) { ttsSocket.close(); ttsSocket = null; }
      saveTranscript();
    });
  });
}

