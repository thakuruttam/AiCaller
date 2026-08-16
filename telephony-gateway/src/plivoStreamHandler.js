import WebSocket, { WebSocketServer } from 'ws';
import { VoiceAgent } from './VoiceAgent.js';
import { prisma } from './db.js';
import { publishEvaluation } from './queues/ingestQueue.js';
import { redis } from './redis.js';
import { setupSTT } from './providers/stt.js';
import { speakBackToPlivo, DeepgramTTSSocket } from './providers/tts.js';
import { createNotification, notifyWorkspace } from './utils/notifications.js';
import { hangupCall } from './hangupCall.js';
import { startPlivoRecording } from './plivoRest.js';

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
    let ttsSocket = null;     // persistent Deepgram TTS WebSocket, opened on call start
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

    // Transcript accumulation buffer — merges multiple Deepgram finals that arrive
    // within TRANSCRIPT_BUFFER_MS of each other into one coherent user turn before
    // the agent processes it. Prevents mid-sentence STT cuts from being treated as
    // complete answers and assigning speech to the wrong question.
    let transcriptAccumulator = '';
    let transcriptTimer = null;
    const TRANSCRIPT_BUFFER_MS = parseInt(process.env.TRANSCRIPT_BUFFER_MS || '200', 10);

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

    // Hard 40-second cap per question/answer cycle.
    let maxAnswerTimer = null;
    const MAX_ANSWER_SECONDS = parseInt(process.env.MAX_ANSWER_SECONDS || '40', 10);

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
      pendingTranscript = '';
      pendingUtteranceEnd = false;
      clearMaxAnswerTimer();
      clearNoAnswerTimer();
    };

    let campaignLanguage = 'English'; // will be updated when campaign loads

    const flushTranscript = async () => {
      const fullTranscript = transcriptAccumulator.trim();
      transcriptAccumulator = '';
      transcriptTimer = null;
      if (!fullTranscript || !agent || isCallEnding) return;

      if (isFlushingTranscript) {
        console.log(`[STT] Agent busy — dropping concurrent transcript: "${fullTranscript}"`);
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
      transcriptTimer = setTimeout(flushTranscript, TRANSCRIPT_BUFFER_MS);
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

            if (campaignLanguage === 'English') {
              ttsSocket = new DeepgramTTSSocket();
            }

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
              language: campaignLanguage
            });

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
                    isSpeaking = true;
                    await speakBackToPlivo(ws, streamSid, closing, campaignLanguage, ttsSocket);
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
              isSpeaking = true;
              const ok = await speakBackToPlivo(ws, streamSid, greeting, campaignLanguage, ttsSocket);
              if (!ok) isSpeaking = false;
              else if (agent.expectsUserReply) startNoAnswerTimer();
            } else {
              console.warn('[Agent] Greeting was empty after sanitization — check callIntro config or LLM response.');
            }
          }
          break;

        case 'media':
          // Pipe raw mu-law audio to STT Provider.
          if (sttStream) {
            const audioPayload = Buffer.from(msg.media.payload, 'base64');
            sttStream.sendAudio(audioPayload);
          }
          break;

        case 'playedStream':
          // Plivo's echo of our 'checkpoint' event, once that buffered audio
          // has actually played out to the caller — equivalent to Twilio's mark.
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

  return wss;
}
