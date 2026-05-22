import WebSocket, { WebSocketServer } from 'ws';
import { VoiceAgent } from './VoiceAgent.js';
import { prisma } from './db.js';
import twilio from 'twilio';
import { publishEvaluation } from './queues/ingestQueue.js';
import { redis } from './redis.js';
import { setupSTT } from './providers/stt.js';
import { speakBackToTwilio } from './providers/tts.js';

export function setupTwilioStream(server) {
  const wss = new WebSocketServer({ server, path: '/streams' });

  wss.on('connection', async (ws) => {
    console.log('[Stream] Twilio connected via WebSocket');
    
    let streamSid = null;
    let agent = null;
    let sttStream = null;
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

    // Per-question no-answer retry: if user doesn't speak for 15s, re-ask; after 2 retries, move on
    let noAnswerTimer = null;
    let noAnswerRetries = 0;
    const NO_ANSWER_SECONDS = parseInt(process.env.NO_ANSWER_SECONDS || '15', 10);
    const NO_ANSWER_MAX_RETRIES = parseInt(process.env.NO_ANSWER_MAX_RETRIES || '2', 10);

    function clearNoAnswerTimer() {
      if (noAnswerTimer) clearTimeout(noAnswerTimer);
    }

    function startNoAnswerTimer() {
      clearNoAnswerTimer();
      // Only wait for a reply after questions — not after instructions/information
      if (!agent?.expectsUserReply) return;

      const waitSeconds = NO_ANSWER_SECONDS;

      noAnswerTimer = setTimeout(async () => {
        if (isCallEnding || isSpeaking || !agent || !agent.expectsUserReply) return;

        noAnswerRetries++;
        console.log(`[Stream] No answer for ${NO_ANSWER_SECONDS}s. Retry ${noAnswerRetries}/${NO_ANSWER_MAX_RETRIES}`);

        let directive;
        if (noAnswerRetries <= NO_ANSWER_MAX_RETRIES) {
          // Look up the exact text of the question that was most recently asked
          // (currentIndex already advanced, so the last asked question is at currentIndex - 1)
          const lastAskedIdx = agent.currentIndex - 1;
          const lastAskedItem = agent.items[lastAskedIdx];
          const exactText = lastAskedItem?.text;

          if (exactText && (lastAskedItem?.itemType || 'question') === 'question') {
            // Inject the exact question text so the LLM cannot rephrase it
            directive = `(System: The user has not responded. Say "Are you still there?" and then immediately repeat this exact question word for word: "${exactText}". Do NOT change a single word.)`;
          } else {
            // No question text available (e.g. call is at closure) — just check in
            directive = `(System: The user has not responded. Ask "Are you still there?" and wait.)`;
          }
        } else {
          noAnswerRetries = 0;
          // Move on — let the agent state machine handle the next question naturally
          directive = `(System: The user has still not responded after repeated attempts. Say "I'll try reaching you another time. Have a great day. HANGUP_NOW" — nothing else.)`;
        }

        const reply = await agent.processInput(directive);
        if (reply && reply.length > 0) {
          isSpeaking = true;
          const ok = await speakBackToTwilio(ws, streamSid, reply, campaignLanguage);
          if (!ok) isSpeaking = false;
          else if (agent.expectsUserReply) startNoAnswerTimer();
        }
      }, waitSeconds * 1000);
    }

    /** After instruction-only TTS, advance to the next scripted segment without waiting. */
    async function autoAdvanceScript() {
      if (!agent || isCallEnding || isSpeaking || agent.expectsUserReply) return;

      const reply = await agent.continueWithoutUser();
      if (callSid) await agent.saveState(redis, callSid);
      if (agent.shouldHangUp) isCallEnding = true;

      if (reply && reply.length > 0) {
        isSpeaking = true;
        const ok = await speakBackToTwilio(ws, streamSid, reply, campaignLanguage);
        if (!ok) isSpeaking = false;
        else if (agent.expectsUserReply) startNoAnswerTimer();
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
              reportWebhook:     currentCampaign.callSettings?.reportWebhook ?? null
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

    // 1. Setup STT Provider (Deferred until 'start' event when language is known)
    let campaignLanguage = 'English'; // will be updated when campaign loads

    // Define the transcript handler that will be passed to the STT provider
    const handleTranscript = async (transcript) => {
      console.log(`[STT] Final Transcript: ${transcript}`);
      // Reset no-answer retries on every real user utterance
      noAnswerRetries = 0;
      clearNoAnswerTimer();
      resetSilenceTimeout();
      
      if (agent) {
        const reply = await agent.processInput(transcript);
        if (callSid) await agent.saveState(redis, callSid);
        if (agent.shouldHangUp) isCallEnding = true;
        console.log(`[Agent] Reply: ${reply}`);

        if (reply.length > 0) {
          isSpeaking = true;
          const success = await speakBackToTwilio(ws, streamSid, reply, campaignLanguage);
          if (!success) isSpeaking = false;
          else if (agent.expectsUserReply) startNoAnswerTimer();
        } else if (isCallEnding) {
          console.log(`[Stream] No TTS needed. Executing final hangup for ${callSid}!`);
          try {
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            await client.calls(callSid).update({ status: 'completed' });
          } catch (e) {
            console.error("[Stream] Failed to hang up via API:", e.message);
          }
        }
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
            await prisma.callLog.update({
              where: { id: callLogId },
              data: { providerRef: callSid }
            });
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

            // Initialize STT provider with the correct language
            if (sttStream) {
              sttStream.close();
            }
            sttStream = setupSTT(campaignLanguage, {
              onTranscript: handleTranscript,
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
              const ok = await speakBackToTwilio(ws, streamSid, greeting, campaignLanguage);
              if (!ok) isSpeaking = false;
              else if (agent.expectsUserReply) startNoAnswerTimer();
            } else {
              console.warn('[Agent] Greeting was empty after sanitization — check callIntro config or LLM response.');
            }
          }
          break;

        case 'media':
          // Pipe raw mu-law audio to STT Provider
          if (sttStream && !isSpeaking) {
            const audioPayload = Buffer.from(msg.media.payload, 'base64');
            sttStream.sendAudio(audioPayload);
          }
          break;

        case 'mark':
          if (msg.mark?.name === 'end_of_tts') {
            isSpeaking = false; // Release the lock so the bot can listen again
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
              if (agent?.expectsUserReply) startNoAnswerTimer();
            }
          }
          break;

        case 'stop':
          console.log('[Stream] Stopped');
          clearSilenceTimeout();
          clearNoAnswerTimer();
          if (sttStream) {
            sttStream.close();
          }
          saveTranscript();
          break;
      }
    });

    ws.on('close', () => {
      console.log('[Stream] Client disconnected');
      clearSilenceTimeout();
      clearNoAnswerTimer();
      if (sttStream) {
        sttStream.close();
      }
      saveTranscript();
    });
  });
}

