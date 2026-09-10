import WebSocket, { WebSocketServer } from 'ws';
import { VoiceAgent } from './VoiceAgent.js';
import { prisma } from './db.js';
import { publishEvaluation } from './queues/ingestQueue.js';
import { redis } from './redis.js';
import { setupSTT } from './providers/stt.js';
import { speakBackToPlivo } from './providers/tts.js';
import { setupRealtime } from './providers/openaiRealtime.js';
import { createNotification, notifyWorkspace } from './utils/notifications.js';
import { hangupCall } from './hangupCall.js';
import { startPlivoRecording } from './plivoRest.js';

// Tool contract for autonomous (free-flowing) realtime calls — see
// VoiceAgent.generateAutonomousInstructions() for the matching instructions
// telling the model when/how to call these. Realtime API tool definitions
// are flat ({type,name,description,parameters}), unlike Chat Completions'
// nested {type,function:{name,...}} shape used by VoiceAgent's decision-
// engine tool — easy to mix up, verify against the live API if tool calls
// aren't arriving as expected.
const AUTONOMOUS_TOOLS = [
  {
    type: 'function',
    name: 'answer_captured',
    description: "Call once the caller has given a real, clear answer to the current question.",
    parameters: {
      type: 'object',
      properties: { question_id: { type: 'string' } },
      required: ['question_id']
    }
  },
  {
    type: 'function',
    name: 'skip_to_question',
    description: "Call to jump to a specific question because the caller's answer satisfied a configured skip condition.",
    parameters: {
      type: 'object',
      properties: { question_id: { type: 'string' } },
      required: ['question_id']
    }
  },
  {
    type: 'function',
    name: 'end_call',
    description: 'Call when the conversation should end — all questions covered, or the caller declined/was busy/was the wrong person.',
    parameters: {
      type: 'object',
      properties: { reason: { type: 'string', enum: ['completed', 'declined', 'busy', 'wrong_person'] } },
      required: ['reason']
    }
  }
];

// noServer: true — the shared 'upgrade' router in server.js dispatches to this
// by pathname, since a `ws` WebSocketServer bound directly via {server, path}
// installs its own unconditional 'upgrade' listener that would 400 any other path.
export function setupPlivoStream() {
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', async (ws, req) => {
    console.log('[Stream] Plivo connected via WebSocket');

    // campaignId/callLogId travel as query params on the wss:// URL we hand
    // Plivo in the <Stream> XML (Plivo has no <Parameter> child element like
    // Twilio, so this is the reliable way to pass them through).
    const url        = new URL(req.url, 'http://internal');
    const campaignId = url.searchParams.get('campaignId') || '';
    const callLogIdQ = url.searchParams.get('callLogId')  || '';

    let streamSid = null;   // Plivo's streamId
    let agent = null;
    let sttStream = null;
    let realtimeSession = null;   // set instead of sttStream when the realtime engine is active for this call
    // Gate: only English campaigns, only when explicitly enabled. An empty/
    // unset REALTIME_ENGINE_CAMPAIGN_IDS means ALL campaigns — widened here
    // per explicit instruction after the decision-engine rewrite, past the
    // single-test-campaign scope this was originally gated to. Set it back
    // to a specific comma-separated list to re-scope to a subset without a
    // code change if something needs pulling back. Hindi/Hinglish keeps
    // using Sarvam/Deepgram (sttStream) untouched regardless, until the
    // realtime engine's transcription quality on Indian-accented phone
    // audio is validated against it.
    const realtimeCampaignIds = (process.env.REALTIME_ENGINE_CAMPAIGN_IDS || '')
      .split(',').map(id => id.trim()).filter(Boolean);
    const realtimeEnabled = process.env.REALTIME_ENGINE === 'true'
      && (realtimeCampaignIds.length === 0 || realtimeCampaignIds.includes(campaignId));
    // Autonomous (free-flowing, tool-calling) mode is a further-gated subset
    // of realtime calls — deliberately NOT widened alongside REALTIME_ENGINE_
    // CAMPAIGN_IDS above. This is a bigger architectural change than the
    // decision-engine rewrite (the model drives the conversation itself, not
    // our code) and needs its own live-validation cycle on an explicit test
    // campaign before it's trusted anywhere near the traffic the decision-
    // engine mode already carries.
    const autonomousCampaignIds = (process.env.REALTIME_AUTONOMOUS_CAMPAIGN_IDS || '')
      .split(',').map(id => id.trim()).filter(Boolean);
    let useAutonomous = false; // finalized once campaignLanguage is known, below
    let pendingAutonomousTransition = false; // true from call start until the greeting finishes and we switch modes
    // Always null — the persistent Deepgram TTS WebSocket (DeepgramTTSSocket
    // in providers/tts.js) is no longer opened. It was meant to save the
    // ~150-200ms per-turn reconnect cost of plain REST calls, but in
    // practice Deepgram was closing it after nearly every single turn
    // anyway (no persistence benefit left) while occasionally stalling a
    // turn for the full 30s SPEAK_TIMEOUT_MS before recovering — real calls
    // were hitting that stall on every turn in a row, worse than the REST
    // path it was supposed to avoid. speakBackToPlivo() already falls back
    // to the plain REST call whenever this is null, so leaving it null
    // makes REST the only path — slightly higher steady-state latency per
    // turn, but no multi-second stall risk. The class itself is left intact
    // in providers/tts.js in case Deepgram's WS reliability improves later.
    let ttsSocket = null;
    let isSpeaking = false;
    let callLogId = callLogIdQ;
    let callSid = null;      // Plivo's callId (real call_uuid)
    let transcriptSaved = false;
    let isCallEnding = false;
    let currentCampaign = null;
    let currentCallLog = null;
    let campaignContact = null;

    let callStartTime = null;
    let silenceTimeout = null;
    const timeoutSeconds = parseInt(process.env.VOICE_TIMEOUT_SECONDS || '60', 10);

    // Turn-taking design: a plain 2-second cutoff (tried today) split a real
    // caller's answers 3 separate times in ONE call — "Yeah. My current role
    // is" <2s pause> "to lead to engineer..." — because natural mid-sentence
    // pauses for this kind of open-ended question routinely run just past 2s.
    // Each split misrouted the tail of one answer onto the NEXT question,
    // burning retries on fragments that were never real attempts at that
    // question. IDLE_MS is the first "looks done" signal (matches Deepgram's
    // own ~2s UtteranceEnd, and doubles as our own local backstop if that
    // signal is late/missing); SETTLE_MS is an extra grace period after
    // EITHER signal before actually committing — long enough to catch a
    // same-breath continuation, short enough to stay snappy. Effective
    // silence-before-flush is IDLE_MS + SETTLE_MS (~3.2s combined).
    // MAX_ANSWER_SECONDS below remains the sole hard ceiling for a caller who
    // never produces a clean gap at all.
    let transcriptAccumulator = '';
    let transcriptTimer = null;
    const TRANSCRIPT_IDLE_MS = parseInt(process.env.TRANSCRIPT_IDLE_MS || '2000', 10);
    const TRANSCRIPT_SETTLE_MS = parseInt(process.env.TRANSCRIPT_SETTLE_MS || '1200', 10);

    function armSettleAndFlush() {
      if (transcriptTimer) clearTimeout(transcriptTimer);
      transcriptTimer = setTimeout(maybeFlush, TRANSCRIPT_SETTLE_MS);
    }

    // Without mandatory-answer validation, a fragment like "Yeah. I worked
    // with" (cut off mid-thought, no closing punctuation) used to get caught
    // by that check; now nothing stops it from being accepted as a complete
    // answer and silently skipping past the real question. Give a fragment
    // that clearly trails off ONE extra full wait cycle to catch a genuine
    // continuation — silently, no spoken retry — before accepting it as-is
    // regardless. Bounded to once per turn so a caller whose STT transcript
    // never gets closing punctuation (a real Deepgram quirk, not always a
    // sign of an actual fragment) doesn't get stuck waiting indefinitely.
    let extendedForIncompleteness = false;

    function maybeFlush() {
      const looksComplete = /[.?!]$/.test(transcriptAccumulator.trim());
      if (!looksComplete && !extendedForIncompleteness && transcriptAccumulator.trim()) {
        extendedForIncompleteness = true;
        console.log(`[STT] Answer looks cut off (no closing punctuation) — waiting once more before accepting it: "${transcriptAccumulator}"`);
        transcriptTimer = setTimeout(armSettleAndFlush, TRANSCRIPT_IDLE_MS);
        return;
      }
      flushTranscript();
    }

    // Buffer for user speech that arrives WHILE the bot is speaking (isSpeaking=true).
    // Rather than dropping it, we accumulate it and replay once TTS ends.
    let pendingTranscript = '';

    // Set to true when UtteranceEnd fires while isSpeaking. Signals that the buffered
    // speech is complete and should be flushed immediately once TTS finishes.
    let pendingUtteranceEnd = false;

    // Set to true when the user interrupts the bot (barge-in). The stale
    // checkpoint echo (playedStream) that Plivo may still fire after a
    // `clearAudio` is ignored so it doesn't re-trigger post-TTS logic.
    let bargedIn = false;

    // Dedup guard: STT providers sometimes fire a delayed second final for the
    // same utterance. Track the last flushed text + timestamp and drop any
    // transcript that exactly matches it within a 5-second window.
    let lastFlushedTranscript = '';
    let lastFlushedTime = 0;

    // Per-question no-answer retry: if user is completely silent for NO_ANSWER_SECONDS,
    // ask "are you still there?" once. After 1 retry, skip to the next question.
    let noAnswerTimer = null;
    let noAnswerRetries = 0;
    let noAnswerTimerActive = false;
    const NO_ANSWER_SECONDS = parseInt(process.env.NO_ANSWER_SECONDS || '10', 10);
    const NO_ANSWER_MAX_RETRIES = parseInt(process.env.NO_ANSWER_MAX_RETRIES || '1', 10);

    // Hard cap per question/answer cycle — the fallback when the caller
    // never produces a clean gap at all (TRANSCRIPT_IDLE_MS/SETTLE_MS above).
    let maxAnswerTimer = null;
    const MAX_ANSWER_SECONDS = parseInt(process.env.MAX_ANSWER_SECONDS || '30', 10);

    function clearMaxAnswerTimer() {
      if (maxAnswerTimer) { clearTimeout(maxAnswerTimer); maxAnswerTimer = null; }
    }

    function startMaxAnswerTimer() {
      clearMaxAnswerTimer();
      if (!agent?.expectsUserReply) return;

      maxAnswerTimer = setTimeout(async () => {
        maxAnswerTimer = null;
        if (isCallEnding || !agent || agent.done) return;
        if (isSpeaking || isFlushingTranscript) return;
        console.log(`[Stream] Max answer time (${MAX_ANSWER_SECONDS}s) reached — forcing advance`);

        clearNoAnswerTimer();

        if (transcriptAccumulator.trim()) {
          if (transcriptTimer) { clearTimeout(transcriptTimer); transcriptTimer = null; }
          console.log(`[Stream] Flushing partial transcript on max-answer timeout: "${transcriptAccumulator}"`);
          await flushTranscript();
          return;
        }

        if (isFlushingTranscript) return;
        const reply = await agent.continueWithoutUser();
        if (callSid) await agent.saveState(redis, callSid);
        if (agent.shouldHangUp) isCallEnding = true;
        if (reply && reply.length > 0) {
          isSpeaking = true;
          const ok = await speakBackToPlivo(ws, streamSid, reply, campaignLanguage, ttsSocket);
          if (!ok) isSpeaking = false;
        }
      }, MAX_ANSWER_SECONDS * 1000);
    }

    let isFlushingTranscript = false;

    function clearNoAnswerTimer() {
      if (noAnswerTimer) clearTimeout(noAnswerTimer);
      noAnswerTimerActive = false;
    }

    function startNoAnswerTimer() {
      clearNoAnswerTimer();
      if (!agent?.expectsUserReply) return;

      noAnswerTimerActive = true;
      noAnswerTimer = setTimeout(async () => {
        if (!noAnswerTimerActive || isCallEnding || isSpeaking || isFlushingTranscript || !agent || !agent.expectsUserReply) return;

        noAnswerRetries++;
        console.log(`[Stream] No answer for ${NO_ANSWER_SECONDS}s. Retry ${noAnswerRetries}/${NO_ANSWER_MAX_RETRIES}`);

        let reply;
        if (noAnswerRetries <= NO_ANSWER_MAX_RETRIES) {
          const lastAskedIdx = agent.currentIndex - 1;
          const lastAskedItem = agent.items[lastAskedIdx];
          const exactText = lastAskedItem?.text
            ? lastAskedItem.text.replace(/\[([^\]]+)\]/g, '$1')
            : null;

          let directive;
          if (exactText && (lastAskedItem?.itemType || 'question') === 'question') {
            directive = `(System: The user has not responded. Say "Are you still there?" and then immediately repeat this exact question word for word: "${exactText}". Do NOT change a single word.)`;
          } else {
            directive = `(System: The user has not responded. Ask "Are you still there?" and wait.)`;
          }
          reply = await agent.processInput(directive);
        } else {
          noAnswerRetries = 0;
          reply = await agent.continueWithoutUser();
        }

        if (!noAnswerTimerActive || isCallEnding) {
          console.log('[Stream] No-answer timer response discarded — user answered or call already ending');
          return;
        }

        if (callSid) await agent.saveState(redis, callSid);
        if (agent.shouldHangUp) isCallEnding = true;

        if (reply && reply.length > 0) {
          isSpeaking = true;
          const ok = await speakBackToPlivo(ws, streamSid, reply, campaignLanguage, ttsSocket);
          if (!ok) isSpeaking = false;
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
        const ok = await speakBackToPlivo(ws, streamSid, reply, campaignLanguage, ttsSocket);
        if (!ok) isSpeaking = false;
      } else if (isCallEnding) {
        try {
          await hangupCall(callSid);
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
          await hangupCall(callSid);
        } catch (e) {
          console.error("[Stream] Failed to hang up via API on timeout:", e.message);
        }
      }, timeoutSeconds * 1000);
    }

    async function saveTranscript() {
      if (transcriptSaved) return;
      transcriptSaved = true;

      if (callSid) await VoiceAgent.clearState(redis, callSid);

      if (callLogId) {
        try {
          const durationMs = callStartTime ? Date.now() - callStartTime : 0;
          const billableMinutes = Math.max(1, Math.ceil(durationMs / 60000));
          const current = await prisma.callLog.findUnique({ where: { id: callLogId }, select: { status: true, tenantId: true } });
          if (current?.status === 'in-progress') {
            await prisma.callLog.update({ where: { id: callLogId }, data: { status: 'completed', durationMs, billableMinutes } });
            console.log(`[Stream] Finalized callLog ${callLogId} status → completed (${billableMinutes} billable min)`);
          }
          if (current?.tenantId) {
            await prisma.$transaction(async (tx) => {
              const t = await tx.tenant.findUnique({ where: { id: current.tenantId }, select: { minuteBalance: true } });
              await tx.tenant.update({
                where: { id: current.tenantId },
                data: { minuteBalance: Math.max(0, (t?.minuteBalance || 0) - billableMinutes) },
              });
            });
          }
        } catch (e) {
          console.warn('[Stream] Could not finalize callLog status:', e.message);
        }

        if (currentCampaign?.createdById && currentCampaign?.tenantId) {
          createNotification({
            userId: currentCampaign.createdById,
            tenantId: currentCampaign.tenantId,
            type: 'CALL_COMPLETED',
            title: 'Call completed',
            body: `A call from campaign "${currentCampaign.name}" has finished.`,
            link: `/calls/${callLogId}`
          });
        }

        if (currentCampaign?.id && currentCampaign?.tenantId) {
          try {
            const pendingCount = await prisma.callLog.count({
              where: {
                campaignId: currentCampaign.id,
                status: { in: ['queued', 'in-progress'] }
              }
            });
            if (pendingCount === 0) {
              notifyWorkspace({
                tenantId: currentCampaign.tenantId,
                type: 'CAMPAIGN_COMPLETED',
                title: `Campaign "${currentCampaign.name}" completed`,
                body: `All calls in "${currentCampaign.name}" have finished.`,
                link: `/campaigns/${currentCampaign.id}`
              });
            }
          } catch (e) {
            console.warn('[Stream] Could not check campaign completion:', e.message);
          }
        }
      }

      try {
        const history = agent?.getHistory().filter(msg => msg.role !== 'system') || [];

        const header = callSid ? `[Plivo_CallUUID:${callSid}]\n\n` : '';
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

        console.log(`[Stream] Queueing eval... callLogId: ${callLogId}, currentCampaign exists: ${!!currentCampaign}`);
        if (callLogId && currentCampaign) {
          try {
            await publishEvaluation(currentCampaign.tenantId, {
              callLogId,
              campaignId:        currentCampaign.id,
              tenantId:          currentCampaign.tenantId,
              contactName:       campaignContact?.overrides?.name || currentCallLog?.contact?.name,
              contactPhone:      currentCallLog?.contact?.phone,
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
    // Send Plivo `clearAudio` to drain the audio buffer immediately so the bot
    // stops speaking, then flip isSpeaking so the transcript goes straight to
    // the accumulator instead of pendingTranscript.
    const handleSpeechStart = () => {
      if (!isSpeaking) return;
      console.log('[Stream] Barge-in: user interrupted bot — sending clearAudio');
      bargedIn = true;
      isSpeaking = false;
      if (ws.readyState === ws.OPEN && streamSid) {
        ws.send(JSON.stringify({ event: 'clearAudio', streamId: streamSid }));
      }
      // pendingTranscript can already hold a COMPLETE, finalized utterance from
      // earlier in the same bot turn (e.g. a quick "Yes" right after the
      // greeting) that just hadn't been delivered yet. A second, louder
      // utterance triggering this barge-in doesn't make that first one stale —
      // wiping it here silently dropped real answers. Carry it into the
      // accumulator (where the new speech will land once transcribed) instead,
      // and schedule a flush in case no follow-up speech ever arrives.
      if (pendingTranscript) {
        transcriptAccumulator = transcriptAccumulator
          ? `${transcriptAccumulator} ${pendingTranscript}`
          : pendingTranscript;
        if (transcriptTimer) clearTimeout(transcriptTimer);
        transcriptTimer = setTimeout(armSettleAndFlush, TRANSCRIPT_IDLE_MS);
      }
      pendingTranscript = '';
      pendingUtteranceEnd = false;
      clearMaxAnswerTimer();
      clearNoAnswerTimer();
    };

    // Fires on any detected speech energy from the STT provider, independent
    // of whether it's produced a transcript yet. Without this, the no-answer
    // timer only resets on a COMPLETED transcript — for Sarvam's REST/VAD
    // pipeline that can be 10s+ into a long answer, so a real call got
    // interrupted with "Are you still there?" while the caller was still
    // mid-sentence answering the question that was just asked.
    const handleSpeechActivity = () => {
      if (!isSpeaking) clearNoAnswerTimer();
    };

    // ── Realtime engine turn handling ──────────────────────────────────
    // Self-contained on purpose: does not touch transcriptAccumulator,
    // transcriptTimer, pendingTranscript, or any of the other STT-timing
    // state above — semantic_vad in providers/openaiRealtime.js already
    // decides when a turn is complete, so none of that machinery applies
    // here. Mirrors the shape of flushTranscript() (call agent.processInput,
    // save state, speak the reply, hang up if needed) without the
    // accumulation/settle/retry logic that exists solely to compensate for
    // silence-timer-based STT.
    let realtimeBusy = false;
    // Set while waiting for Plivo's playedStream echo confirming the realtime
    // path's closing message actually finished playing before we hang up —
    // see the onResponseDone/playedStream handlers below.
    let awaitingRealtimeHangupCheckpoint = false;
    // No fixed merge-grace delay anymore — semantic_vad already decided the
    // turn was complete before emitting this transcript at all; re-buffering
    // after that just re-adds a fixed tax (was 2500ms) on every single turn
    // and second-guesses a judgment the model already made. If a decision
    // call is still in flight when the next transcript arrives (the caller
    // kept talking, or started a new turn immediately), it's appended here
    // and picked up the moment the in-flight call finishes — not dropped,
    // not delayed by an artificial timer.
    let realtimePendingTranscript = '';

    const handleRealtimeTranscript = (transcript) => {
      // Was missing entirely on this path — the call-level 60s silence
      // timeout (VOICE_TIMEOUT_SECONDS) is only ever reset by the OLD STT
      // path's handleTranscript(). Without this, a live call hung up
      // exactly 60s after it started regardless of how much active,
      // healthy conversation was happening, because nothing on the
      // realtime path ever told it "something just happened."
      resetSilenceTimeout();
      if (!agent || isCallEnding) return;

      realtimePendingTranscript = realtimePendingTranscript ? `${realtimePendingTranscript} ${transcript}` : transcript;
      dispatchRealtimeTurn();
    };

    const dispatchRealtimeTurn = async () => {
      if (realtimeBusy) return; // already in flight — picked up on completion below, once it frees up

      const fullTranscript = realtimePendingTranscript.trim();
      if (!fullTranscript || !agent || isCallEnding) {
        realtimePendingTranscript = '';
        return;
      }

      realtimePendingTranscript = '';
      realtimeBusy = true;
      console.log(`[Realtime] Processing turn: "${fullTranscript}"`);

      let reply;
      try {
        reply = await agent.processInput(fullTranscript);
      } catch (e) {
        console.error('[Realtime] Uncaught error from agent.processInput:', e.message);
        realtimeBusy = false;
        if (realtimePendingTranscript.trim()) dispatchRealtimeTurn();
        return;
      }
      realtimeBusy = false;

      if (transcriptSaved) return;

      if (callSid) await agent.saveState(redis, callSid);
      if (agent.shouldHangUp) isCallEnding = true;
      console.log(`[Agent] Reply: ${reply}`);

      if (reply && reply.length > 0) {
        realtimeSession.speak(reply);
      } else if (isCallEnding) {
        try {
          await hangupCall(callSid);
        } catch (e) {
          console.error('[Stream] Failed to hang up via API:', e.message);
        }
      }

      if (realtimePendingTranscript.trim() && !isCallEnding) dispatchRealtimeTurn();
    };

    // ── Autonomous mode turn handling ────────────────────────────────────
    // No agent.processInput() call here at all — the Realtime session
    // decides what to say on its own (create_response:true). This just
    // records the transcript for saveTranscript() and watches for a stall
    // (see VoiceAgent.isAutonomousStalled) since there's no per-turn
    // decision call left to attach a repeat cap to otherwise.
    const handleAutonomousTranscript = (transcript) => {
      resetSilenceTimeout();
      if (!agent || isCallEnding) return;
      agent.appendTranscriptTurn('user', transcript);
      agent.noteAutonomousTurn();

      if (agent.isAutonomousStalled()) {
        console.warn('[Stream] Autonomous mode stalled — forcing progress past the current question');
        const stalledItem = agent.currentItem();
        if (stalledItem) agent.recordAnswerCaptured(stalledItem.id);

        const nextItem = agent.currentItem();
        if (nextItem) {
          realtimeSession.interruptAndSpeak(nextItem.text);
          agent.appendTranscriptTurn('assistant', nextItem.text);
        } else {
          agent.recordEndCall('completed');
          isCallEnding = true;
          const closingText = agent.config.callSignOff || 'Thank you for your time. Goodbye.';
          realtimeSession.interruptAndSpeak(closingText);
          agent.appendTranscriptTurn('assistant', closingText);
        }
        if (callSid) agent.saveState(redis, callSid);
      }
    };

    const handleAutonomousToolCall = (name, args) => {
      if (!agent || isCallEnding) return;
      switch (name) {
        case 'answer_captured':
          agent.recordAnswerCaptured(args.question_id);
          if (callSid) agent.saveState(redis, callSid);
          break;
        case 'skip_to_question':
          agent.recordSkip(args.question_id);
          if (callSid) agent.saveState(redis, callSid);
          break;
        case 'end_call': {
          agent.recordEndCall(args.reason);
          isCallEnding = true;
          // Force the configured verbatim closing line rather than trust
          // whatever the model was mid-sentence composing when it decided
          // to end the call — same reasoning as the decision engine's
          // forced sign-off, now via interruptAndSpeak since a response may
          // already be generating for this same turn.
          const closingText = args.reason === 'completed'
            ? (agent.config.callSignOff || 'Thank you for your time. Goodbye.')
            : 'I apologize for the interruption. Have a great day.';
          realtimeSession.interruptAndSpeak(closingText);
          agent.appendTranscriptTurn('assistant', closingText);
          if (callSid) agent.saveState(redis, callSid);
          break;
        }
        default:
          console.warn(`[Stream] Autonomous mode: unknown tool call "${name}" — ignored.`);
      }
    };

    let campaignLanguage = 'English'; // will be updated when campaign loads

    const flushTranscript = async () => {
      const fullTranscript = transcriptAccumulator.trim();
      transcriptAccumulator = '';
      transcriptTimer = null;
      extendedForIncompleteness = false;
      if (!fullTranscript || !agent || isCallEnding) return;

      if (isFlushingTranscript) {
        // The previous turn's LLM call is still in flight. This is not junk
        // to discard — it's usually the tail end of what the user was
        // saying, arriving a beat after the first part was already
        // dispatched. Route it through the same buffer used for "bot is
        // speaking" so it gets replayed once the current turn resolves,
        // rather than being silently lost — losing it here previously let a
        // skip/end-call condition evaluate an incomplete answer as final.
        console.log(`[STT] Agent busy — buffering transcript to replay after current turn: "${fullTranscript}"`);
        pendingTranscript = pendingTranscript ? `${pendingTranscript} ${fullTranscript}` : fullTranscript;
        return;
      }

      isFlushingTranscript = true;

      lastFlushedTranscript = fullTranscript;
      lastFlushedTime = Date.now();

      console.log(`[STT] Processing turn: "${fullTranscript}"`);

      let reply;
      try {
        reply = await agent.processInput(fullTranscript);
      } catch (e) {
        console.error('[Stream] Uncaught error from agent.processInput — bot would have frozen:', e.message);
        isFlushingTranscript = false;
        if (agent?.expectsUserReply) startNoAnswerTimer();
        return;
      }

      isFlushingTranscript = false;

      // The call can end (WS closed, transcript already saved) while the LLM
      // call above was in flight — e.g. a barge-in collision delaying this
      // turn until after the caller had already hung up. Speaking into a
      // dead socket at that point is pointless and can leave a "reply" logged
      // for a call already marked completed.
      if (transcriptSaved) {
        console.log('[Stream] Call already ended while processing this turn — discarding reply');
        return;
      }

      clearMaxAnswerTimer();
      noAnswerRetries = 0;

      if (callSid) await agent.saveState(redis, callSid);
      if (agent.shouldHangUp) isCallEnding = true;
      console.log(`[Agent] Reply: ${reply}`);

      if (reply && reply.length > 0) {
        isSpeaking = true;
        const success = await speakBackToPlivo(ws, streamSid, reply, campaignLanguage, ttsSocket);
        if (!success) {
          isSpeaking = false;
          if (isCallEnding && callSid) {
            console.warn('[Stream] TTS failed on sign-off turn — hanging up directly');
            try {
              await hangupCall(callSid);
            } catch (e) {
              console.error('[Stream] Hangup after TTS failure:', e.message);
            }
          } else {
            console.warn('[Stream] speakBackToPlivo returned false — restarting no-answer timer');
            if (agent.expectsUserReply) startNoAnswerTimer();
          }
        }
      } else if (isCallEnding) {
        console.log(`[Stream] No TTS needed. Executing final hangup for ${callSid}!`);
        try {
          await hangupCall(callSid);
        } catch (e) {
          console.error("[Stream] Failed to hang up via API:", e.message);
        }
      }

      // Something arrived while this turn was in flight (buffered above into
      // pendingTranscript instead of being dropped). If the bot is now
      // speaking a reply, the existing end-of-TTS replay path will pick it
      // up naturally. If not — e.g. the reply was empty — it would
      // otherwise never get processed at all, so drain it here.
      if (!isSpeaking && !isCallEnding && pendingTranscript && agent) {
        const captured = pendingTranscript;
        pendingTranscript = '';
        handleTranscript(captured);
      }
    };

    const handleTranscript = (transcript) => {
      console.log(`[STT] Final fragment: "${transcript}"`);

      const trimmed = transcript.trim();
      if (
        trimmed.length > 0 &&
        trimmed === lastFlushedTranscript &&
        Date.now() - lastFlushedTime < 5000
      ) {
        console.log(`[STT] Dropped duplicate transcript (already processed): "${trimmed}"`);
        return;
      }

      clearNoAnswerTimer();
      resetSilenceTimeout();

      if (isSpeaking) {
        pendingTranscript = pendingTranscript
          ? `${pendingTranscript} ${transcript}`
          : transcript;
        console.log(`[STT] Bot is speaking — buffered pending transcript: "${pendingTranscript}"`);
        return;
      }

      transcriptAccumulator = transcriptAccumulator
        ? `${transcriptAccumulator} ${transcript}`
        : transcript;

      if (transcriptTimer) clearTimeout(transcriptTimer);
      transcriptTimer = setTimeout(armSettleAndFlush, TRANSCRIPT_IDLE_MS);
    };

    const handleUtteranceEnd = () => {
      if (isCallEnding || !agent) return;

      if (isSpeaking) {
        pendingUtteranceEnd = true;
        console.log('[STT] UtteranceEnd during TTS — will flush pending transcript immediately on end_of_tts');
        return;
      }

      if (transcriptTimer) { clearTimeout(transcriptTimer); transcriptTimer = null; }
      if (transcriptAccumulator.trim()) {
        console.log(`[STT] UtteranceEnd — settling ${TRANSCRIPT_SETTLE_MS}ms before flushing, in case of a same-breath continuation`);
        armSettleAndFlush();
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
        case 'start':
          streamSid = msg.start.streamId;
          callSid = msg.start.callId;
          callStartTime = Date.now();

          console.log(`[Stream] Started: ${streamSid} (Call UUID: ${callSid}) for Campaign: ${campaignId}`);

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

          if (callSid) startPlivoRecording(callSid);

          resetSilenceTimeout();

          const [campaign, callLog] = await Promise.all([
            prisma.campaign.findUnique({
              where: { id: campaignId },
              select: {
                id: true,
                name: true,
                tenantId: true,
                createdById: true,
                rules: true,
                callSettings: true,
                dataToCollect: true,
                endCallIf: true,
                maxCallDurationSec: true,
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
            campaignLanguage = campaign.callSettings?.language || 'English';
            console.log(`[Stream] Campaign language: ${campaignLanguage}`);

            const useRealtime = realtimeEnabled && campaignLanguage === 'English';
            useAutonomous = useRealtime && autonomousCampaignIds.includes(campaignId);
            pendingAutonomousTransition = useAutonomous;

            if (!useRealtime) {
              if (sttStream) sttStream.close();
              sttStream = setupSTT(campaignLanguage, {
                onTranscript:     handleTranscript,
                onUtteranceEnd:   handleUtteranceEnd,
                onSpeechStart:    handleSpeechStart,
                onSpeechActivity: handleSpeechActivity,
                onError: (err) => console.error('[STT] Error:', err),
                onClose: () => console.log('[STT] Closed')
              });
            }
            campaignContact = await prisma.campaignContact.findFirst({
              where: {
                campaignId: campaign.id,
                contactId: callLog.contactId
              }
            });

            const overrides = campaignContact?.overrides || {};

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
              language: campaignLanguage,
              useDecisionEngine: useRealtime,
              useAutonomousEngine: useAutonomous
            });

            if (useRealtime) {
              realtimeSession = setupRealtime(agent.generateSystemPrompt(), {
                onAudio: (chunk) => {
                  if (ws.readyState === ws.OPEN && streamSid) {
                    ws.send(JSON.stringify({
                      event: 'playAudio',
                      media: { contentType: 'audio/x-mulaw', sampleRate: 8000, payload: chunk.toString('base64') }
                    }));
                  }
                },
                onTranscript: useAutonomous ? handleAutonomousTranscript : handleRealtimeTranscript,
                onAssistantTranscript: useAutonomous ? (text) => agent?.appendTranscriptTurn('assistant', text) : undefined,
                onToolCall: useAutonomous ? (name, args) => handleAutonomousToolCall(name, args) : undefined,
                onSpeechActivity: () => resetSilenceTimeout(),
                onSpeechStart: () => {
                  console.log('[Stream] Realtime barge-in — sending clearAudio');
                  if (ws.readyState === ws.OPEN && streamSid) {
                    ws.send(JSON.stringify({ event: 'clearAudio', streamId: streamSid }));
                  }
                },
                onResponseDone: async () => {
                  if (pendingAutonomousTransition) {
                    pendingAutonomousTransition = false;
                    console.log('[Stream] Greeting finished — switching to autonomous conversation mode');
                    realtimeSession.beginAutonomousConversation(
                      agent.generateAutonomousInstructions(),
                      AUTONOMOUS_TOOLS
                    );
                    return;
                  }
                  // onResponseDone fires when the model finishes GENERATING the
                  // closing audio server-side — not when Plivo has actually
                  // finished PLAYING it. Hanging up directly here (as before)
                  // raced the trailing audio still queued in Plivo's buffer, cutting
                  // the goodbye off mid-sentence on a real call. Reuse the same
                  // checkpoint/playedStream ('end_of_tts') confirmation the legacy
                  // TTS path already relies on for exactly this — see the
                  // 'playedStream' case below — with a timeout backstop in case
                  // the echo never arrives.
                  if (isCallEnding && callSid) {
                    if (ws.readyState === ws.OPEN && streamSid) {
                      console.log(`[Stream] Sign-off generated — confirming playback before hangup for ${callSid}`);
                      awaitingRealtimeHangupCheckpoint = true;
                      ws.send(JSON.stringify({ event: 'checkpoint', streamId: streamSid, name: 'end_of_tts' }));
                      setTimeout(async () => {
                        if (!awaitingRealtimeHangupCheckpoint) return; // already hung up via the playedStream echo
                        awaitingRealtimeHangupCheckpoint = false;
                        console.warn(`[Stream] No playedStream echo within 8s of sign-off — hanging up ${callSid} anyway`);
                        try {
                          await hangupCall(callSid);
                        } catch (e) {
                          console.error('[Stream] Failed to hang up via API:', e.message);
                        }
                      }, 8000);
                    } else {
                      try {
                        await hangupCall(callSid);
                      } catch (e) {
                        console.error('[Stream] Failed to hang up via API:', e.message);
                      }
                    }
                  }
                },
                onError: (err) => console.error('[Realtime] Error:', err.message),
                onClose: () => console.log('[Realtime] Closed')
              }, campaignLanguage === 'Hindi' || campaignLanguage === 'Hinglish' ? 'hi' : 'en');
            }

            const effectiveDurationSec = (campaignContact?.overrides?.maxCallDurationSec) || campaign.maxCallDurationSec;
            if (effectiveDurationSec && effectiveDurationSec > 4) {
              const hangupAfterMs = (effectiveDurationSec - 4) * 1000;
              setTimeout(async () => {
                if (transcriptSaved || isCallEnding) return;
                console.log(`[Stream] Max duration (${effectiveDurationSec}s) reached — ending call`);
                isCallEnding = true;
                try {
                  const signOff = finalGoals.callSignOff || "I'm sorry, I need to end this call now. Thank you for your time. Goodbye!";
                  const closingText = `(System: You've reached the maximum call time. Say this exact closing to the user: "${signOff}" — then the call will end.)`;
                  const closing = await agent.processInput(closingText);
                  if (closing) {
                    if (realtimeSession) {
                      realtimeSession.speak(closing);
                    } else {
                      isSpeaking = true;
                      await speakBackToPlivo(ws, streamSid, closing, campaignLanguage, ttsSocket);
                    }
                  }
                } catch (_) {}
                if (callSid) {
                  await hangupCall(callSid);
                }
              }, hangupAfterMs);
              console.log(`[Stream] Max call duration set to ${effectiveDurationSec}s — will hang up in ${hangupAfterMs / 1000}s`);
            }

            let processedIntro = finalGoals.callIntro || 'Hello, this is an AI assistant calling.';
            if (agent.contactName) {
              processedIntro = processedIntro.replace(/\[Name\]/gi, agent.contactName);

              const introLower = processedIntro.toLowerCase();
              if (!introLower.includes('speaking with') && !introLower.includes('is this') && !introLower.includes('are you')) {
                processedIntro = processedIntro.trim();
                if (!processedIntro.endsWith('?') && !processedIntro.endsWith('.')) processedIntro += '.';
                processedIntro += ` Am I speaking with ${agent.contactName}?`;
              }
            }

            const langDirective = campaignLanguage !== 'English'
              ? ` Speak in ${campaignLanguage}. Deliver this greeting translated naturally into ${campaignLanguage}, keeping the meaning identical and adding no extra content.`
              : '';
            const greeting = await agent.processInput(`(System: The call has just been connected. Say this EXACT introduction to the user word for word: "${processedIntro}".${langDirective} Do NOT add any extra sentences or questions beyond what is written.)`);
            console.log(`[Agent] Greeting: ${greeting}`);
            if (greeting && greeting.length > 0) {
              if (useRealtime) {
                // No-answer/max-answer timers are deliberately NOT wired up yet
                // for the realtime path — semantic_vad handles "wait for the
                // caller to finish," but true silence-forever detection
                // ("Are you still there?") still needs its own realtime-native
                // implementation rather than reusing startNoAnswerTimer(),
                // which speaks through the old TTS engine directly.
                realtimeSession.speak(greeting);
              } else {
                isSpeaking = true;
                const ok = await speakBackToPlivo(ws, streamSid, greeting, campaignLanguage, ttsSocket);
                if (!ok) isSpeaking = false;
                else if (agent.expectsUserReply) startNoAnswerTimer();
              }
            } else {
              console.warn('[Agent] Greeting was empty after sanitization — check callIntro config or LLM response.');
            }
          }
          break;

        case 'media': {
          // Pipe raw mu-law audio to whichever engine is active for this call.
          const audioPayload = Buffer.from(msg.media.payload, 'base64');
          if (realtimeSession) {
            realtimeSession.sendAudio(audioPayload);
          } else if (sttStream) {
            sttStream.sendAudio(audioPayload);
          }
          break;
        }

        case 'playedStream':
          // Plivo's echo of our 'checkpoint' event, once that buffered audio
          // has actually played out to the caller — equivalent to Twilio's mark.
          if (msg.name === 'end_of_tts' && awaitingRealtimeHangupCheckpoint) {
            // Realtime path's closing message confirmed actually played —
            // see onResponseDone above. Handled in isolation from the legacy
            // STT-path branches below (isSpeaking/pendingTranscript/
            // autoAdvanceScript are all legacy-only state that don't apply
            // to a realtime call and must not fire here).
            awaitingRealtimeHangupCheckpoint = false;
            console.log(`[Stream] Realtime sign-off confirmed played — hanging up ${callSid}`);
            if (callSid) {
              try {
                await hangupCall(callSid);
              } catch (e) {
                console.error('[Stream] Failed to hang up via API:', e.message);
              }
            }
            break;
          }
          if (msg.name === 'end_of_tts') {
            if (bargedIn) {
              bargedIn = false;
              resetSilenceTimeout();
              console.log('[Stream] Stale playedStream after barge-in — ignored');
              if (isCallEnding && callSid) {
                try {
                  await hangupCall(callSid);
                } catch (e) {
                  console.error('[Stream] Hangup failed after barge-in:', e.message);
                }
              }
              break;
            }

            isSpeaking = false;
            if (transcriptTimer) { clearTimeout(transcriptTimer); transcriptTimer = null; }
            transcriptAccumulator = '';

            if (pendingTranscript && !isCallEnding && agent) {
              const captured = pendingTranscript;
              const utteranceWasComplete = pendingUtteranceEnd;
              pendingTranscript = '';
              pendingUtteranceEnd = false;

              if (utteranceWasComplete) {
                console.log(`[Stream] Flushing barge-in immediately (UtteranceEnd confirmed): "${captured}"`);
                transcriptAccumulator = captured;
                flushTranscript();
              } else {
                console.log(`[Stream] Replaying pending transcript captured during TTS: "${captured}"`);
                handleTranscript(captured);
              }
              break;
            }
            pendingUtteranceEnd = false;

            if (isCallEnding) {
              console.log(`[Stream] TTS finished playing out loud. Executing final hangup for ${callSid}!`);
              try {
                await hangupCall(callSid);
              } catch (e) {
                console.error("[Stream] Failed to hang up via API:", e.message);
              }
            } else if (agent && !agent.expectsUserReply && !agent.done) {
              resetSilenceTimeout();
              await autoAdvanceScript();
            } else {
              resetSilenceTimeout();
              if (agent?.expectsUserReply) {
                startNoAnswerTimer();
                startMaxAnswerTimer();
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
          if (realtimeSession) realtimeSession.close();
          if (ttsSocket) { ttsSocket.close(); ttsSocket = null; }
          saveTranscript();
          break;
      }
    });

    ws.on('close', async () => {
      console.log('[Stream] Client disconnected');
      clearSilenceTimeout();
      clearNoAnswerTimer();
      clearMaxAnswerTimer();
      if (sttStream) sttStream.close();
      if (realtimeSession) realtimeSession.close();
      if (ttsSocket) { ttsSocket.close(); ttsSocket = null; }

      // A proper end-of-call always sends a 'stop' event first (handled above,
      // which already saves the transcript) before the socket closes. Getting
      // here WITHOUT that — a media-stream WS error or network blip — means
      // Plivo may have dropped only the audio stream, not the underlying call
      // itself: the bot has no way to speak or listen anymore, but the caller
      // can still be sitting connected to a dead line indefinitely. Force the
      // actual call to hang up so it doesn't strand them. hangupCall() already
      // swallows errors, so this is a harmless no-op if the call already ended.
      if (!transcriptSaved && callSid) {
        console.warn(`[Stream] Socket closed without a prior 'stop' event — forcing hangup for ${callSid}`);
        try {
          await hangupCall(callSid);
        } catch (e) {
          console.error('[Stream] Forced hangup after abnormal close failed:', e.message);
        }
      }

      saveTranscript();
    });
  });

  return wss;
}
