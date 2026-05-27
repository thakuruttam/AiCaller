// telephony-gateway/src/twilioGatherHandler.js
//
// REST-based call flow using Twilio <Gather input="speech">.
//
// Twilio drives the state machine via three webhooks:
//   POST /call/answer    — call connects, return greeting TwiML
//   POST /call/gather    — speech result arrives, evaluate + advance
//   POST /call/no-input  — user was silent (Gather timed out)
//   POST /call/status    — call ended, save transcript + queue eval
//
// State is persisted in Redis between webhook calls (keyed by CallSid).

import express from 'express';
import twilio from 'twilio';
import { redis } from './redis.js';
import { prisma } from './db.js';
import { publishEvaluation } from './queues/ingestQueue.js';

const router = express.Router();
router.use(express.urlencoded({ extended: false }));

// ── Config ────────────────────────────────────────────────────────────
const SPEECH_TIMEOUT   = parseInt(process.env.SPEECH_TIMEOUT_SECONDS    || '3',  10);
const NO_ANS_TIMEOUT   = parseInt(process.env.NO_ANSWER_TIMEOUT_SECONDS  || '15', 10);
const MAX_ANS_SECONDS  = parseInt(process.env.MAX_ANSWER_SECONDS         || '40', 10);
const MAX_RETRIES      = parseInt(process.env.NO_ANSWER_MAX_RETRIES      || '1',  10);
const STATE_TTL        = 3600; // seconds — calls longer than 1h are extremely unlikely

// ── Voice / STT language maps ─────────────────────────────────────────
const VOICE_MAP = {
  English:  process.env.TWILIO_VOICE       || 'Polly.Joanna',
  Hindi:    process.env.TWILIO_VOICE_HINDI  || 'Polly.Aditi',
  Hinglish: process.env.TWILIO_VOICE_HINDI  || 'Polly.Aditi',
  Spanish:  process.env.TWILIO_VOICE_ES     || 'Polly.Lupe',
};
const STT_LANG_MAP = {
  English:  'en-IN',  // en-IN handles Indian-accented English far better than en-US
  Hindi:    'hi-IN',
  Hinglish: 'hi-IN',
  Spanish:  'es-ES',
};

function voiceFor(language)   { return VOICE_MAP[language]    || VOICE_MAP.English; }
function sttLangFor(language) { return STT_LANG_MAP[language] || 'en-IN'; }

/**
 * Build a comma-separated hints string from campaign items.
 * Hints prime the STT model for domain-specific vocab (tech stacks, job titles, etc.)
 * so they aren't misheard as phonetically similar common words.
 */
function buildHints(items) {
  const seen = new Set();
  const hints = [];
  const add = (str) => {
    if (!str) return;
    const s = str.trim();
    if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); hints.push(s); }
  };
  for (const item of (items || [])) {
    if (item.itemType !== 'question') continue;
    // Expected answer value (e.g. "Node js", "Python", "React")
    if (item.expectedAnswer?.value) add(item.expectedAnswer.value);
    // Skip-condition values
    for (const sc of item.skipConditions || []) { if (sc.value) add(sc.value); }
    // Sub-field names
    for (const f of item.fieldsToExtract || []) { if (f.field) add(f.field); }
  }
  return hints.slice(0, 500).join(',');
}

// ── TwiML builders ────────────────────────────────────────────────────

/**
 * Build a <Gather input="speech"> response.
 * @param {string[]} infoLines    - Information items spoken BEFORE the gather (no reply)
 * @param {string}   questionText - The question spoken INSIDE the gather (reply expected)
 * @param {string}   language
 * @param {number}   timeoutSecs  - Seconds to wait for user to start speaking
 * @param {string}   hints        - Comma-separated STT hint phrases (optional)
 */
function buildGatherTwiML(infoLines, questionText, language, timeoutSecs, hints = '') {
  const twiml = new twilio.twiml.VoiceResponse();
  const v     = voiceFor(language);

  for (const line of infoLines) {
    twiml.say({ voice: v }, line);
  }

  const gatherParams = {
    input:               'speech',
    action:              '/call/gather',
    method:              'POST',
    speechTimeout:       String(SPEECH_TIMEOUT),
    timeout:             String(timeoutSecs),
    enhanced:            'true',
    speechModel:         'phone_call',
    actionOnEmptyResult: 'true',
    language:            sttLangFor(language),
  };
  if (hints) gatherParams.hints = hints;

  const gather = twiml.gather(gatherParams);
  gather.say({ voice: v }, questionText);

  // Safety net: if Gather never fires its action, redirect to no-input handler
  twiml.redirect({ method: 'POST' }, '/call/no-input');
  return twiml.toString();
}

function buildSayHangupTwiML(text, language) {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({ voice: voiceFor(language) }, text);
  twiml.hangup();
  return twiml.toString();
}

// ── Redis state helpers ───────────────────────────────────────────────
const stateKey = (sid) => `gvc:${sid}`;

async function loadState(callSid) {
  const raw = await redis.get(stateKey(callSid));
  return raw ? JSON.parse(raw) : null;
}

async function saveState(callSid, state) {
  await redis.setex(stateKey(callSid), STATE_TTL, JSON.stringify(state));
}

// ── Condition evaluation ──────────────────────────────────────────────

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\.(?=\s|$)/g, '') // "Node. Js" → "Node Js" (Deepgram smart_format artifact)
    .replace(/,/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Word-to-number for "two years", "five years" etc. — covers the common
// "is greater/less than N years" case without a third-party package.
const WORD_NUMS = {
  zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,
  ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,
  sixteen:16,seventeen:17,eighteen:18,nineteen:19,twenty:20,
  thirty:30,forty:40,fifty:50
};

function toNumber(str) {
  const direct = parseFloat((str || '').match(/-?\d+(\.\d+)?/)?.[0]);
  if (!isNaN(direct)) return direct;
  const lower = (str || '').toLowerCase().trim();
  if (WORD_NUMS[lower] !== undefined) return WORD_NUMS[lower];
  // "twenty five" → 25
  let total = 0;
  for (const w of lower.split(/\s+/)) {
    if (WORD_NUMS[w] !== undefined) total += WORD_NUMS[w];
  }
  return total > 0 ? total : NaN;
}

function evalCondition(condition, value, answer) {
  if (!condition || !answer) return false;
  const a = normalize(answer);
  const v = normalize(value || '');
  // Strip spaces AND dots so "node.js" matches "Node js", "react.js" matches "React js" etc.
  const strip = s => s.replace(/[\s.]/g, '');
  const aCompact = strip(a);
  const vCompact = strip(v);
  switch (condition) {
    case 'contains':         return a.includes(v) || aCompact.includes(vCompact);
    case 'does not contain': return !a.includes(v) && !aCompact.includes(vCompact);
    case 'equals':           return a === v;
    case 'starts with':      return a.startsWith(v);
    case 'ends with':        return a.endsWith(v);
    case 'is greater than': {
      const na = toNumber(answer), nv = toNumber(value || '');
      return !isNaN(na) && !isNaN(nv) && na > nv;
    }
    case 'is less than': {
      const na = toNumber(answer), nv = toNumber(value || '');
      return !isNaN(na) && !isNaN(nv) && na < nv;
    }
    case 'is any value': return answer.trim().length > 0;
    default:             return false;
  }
}

// ── Sentiment / identity helpers ──────────────────────────────────────

const NEGATIVE_WORDS = [
  'not interested','stop calling',"don't call",'dont call','wrong number',
  'busy right now','go away','leave me alone','no more calls','not the time',
  'fuck','shit'
];
function isNegative(text) {
  const lower = text.toLowerCase().replace(/[^\w\s]/g, '').trim();
  return NEGATIVE_WORDS.some(w => lower.includes(w));
}

function isDenial(text) {
  const lower = text.toLowerCase();
  return ['no','nope','nah','wrong'].some(w => new RegExp(`\\b${w}\\b`).test(lower))
    || ['not me','not him','not her','wrong number','different person',"that's not"].some(w => lower.includes(w));
}

// ── Transcript helpers ────────────────────────────────────────────────

function pushTranscript(state, role, content) {
  (state.transcriptHistory ??= []).push({ role, content });
}

// ── Filler words ──────────────────────────────────────────────────────

const FILLERS = ['Got it.', 'Okay.', 'Thanks.'];
function withFiller(text) {
  return `${FILLERS[Math.floor(Math.random() * FILLERS.length)]} ${text}`;
}

// ══════════════════════════════════════════════════════════════════════
// Core helper: advance to next script item and send TwiML
// ══════════════════════════════════════════════════════════════════════

async function respondWithNext(state, callSid, res, { isFirstQuestion = false } = {}) {
  const { items, language, callSignOff } = state;
  let idx = state.currentIndex;

  // Collect consecutive information items to speak before the next question
  const infoLines = [];
  while (idx < items.length && (items[idx].itemType || 'question') === 'information') {
    infoLines.push(items[idx].text);
    idx++;
  }

  // No more questions → sign off
  if (idx >= items.length) {
    const finalText = infoLines.length > 0
      ? `${infoLines.join(' ')} ${callSignOff}`
      : callSignOff;
    state.phase        = 'done';
    state.currentIndex = items.length;
    pushTranscript(state, 'assistant', finalText);
    await saveState(callSid, state);
    return res.type('text/xml').send(buildSayHangupTwiML(finalText, language));
  }

  // Next question found
  const qItem  = items[idx];
  const qText  = qItem.text.replace(/\[([^\]]+)\]/g, '$1'); // strip [brackets]
  const spoken = isFirstQuestion ? qText : withFiller(qText);

  // Advance currentIndex PAST this question so prevItem lookup works on the next turn
  state.currentIndex = idx + 1;

  pushTranscript(state, 'assistant', [...infoLines, spoken].join(' '));
  await saveState(callSid, state);

  // Identity phase uses shorter timeout; questions use the 40s max-answer cap
  const timeoutSecs = isFirstQuestion ? NO_ANS_TIMEOUT : MAX_ANS_SECONDS;
  const hints = buildHints(state.items);
  res.type('text/xml').send(buildGatherTwiML(infoLines, spoken, language, timeoutSecs, hints));
}

// ══════════════════════════════════════════════════════════════════════
// POST /call/answer
// Twilio hits this when the outbound call is answered.
// ══════════════════════════════════════════════════════════════════════

router.post('/answer', async (req, res) => {
  console.log('[Gather] /answer webhook received:', { callSid: req.body.CallSid, campaignId: req.query.campaignId, callLogId: req.query.callLogId });
  const callSid    = req.body.CallSid;

  // campaignId and callLogId are injected as query params when the call is created
  const campaignId = req.body.campaignId || req.query.campaignId;
  const callLogId  = req.body.callLogId  || req.query.callLogId;

  try {
    const [campaign, callLog] = await Promise.all([
      prisma.campaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true, name: true, tenantId: true,
          callSettings: true, dataToCollect: true, endCallIf: true,
          callModule: { select: { goal: true, callIntro: true, callSignOff: true, successCriteria: true } }
        }
      }),
      prisma.callLog.findUnique({ where: { id: callLogId }, include: { contact: true } })
    ]);

    if (!campaign || !callLog) {
      console.error(`[Gather] /answer: campaign or callLog not found (campaignId=${campaignId}, callLogId=${callLogId})`);
      return res.type('text/xml').send('<Response><Hangup/></Response>');
    }

    // Persist the real Twilio SID
    await prisma.callLog.update({ where: { id: callLogId }, data: { providerRef: callSid } });

    const campaignContact = await prisma.campaignContact.findFirst({
      where: { campaignId: campaign.id, contactId: callLog.contactId }
    });
    const overrides   = campaignContact?.overrides || {};
    const contactName = overrides.name || callLog.contact?.name || 'there';
    const language    = campaign.callSettings?.language || 'English';

    // Build the greeting, ensuring it asks for identity confirmation
    let callIntro = overrides.goals?.callIntro
      || campaign.callModule?.callIntro
      || `Hello, am I speaking with ${contactName}?`;
    callIntro = callIntro.replace(/\[Name\]/gi, contactName);
    const introLower = callIntro.toLowerCase();
    if (!introLower.includes('speaking with') && !introLower.includes('is this') && !introLower.includes('are you')) {
      if (!callIntro.endsWith('?') && !callIntro.endsWith('.')) callIntro += '.';
      callIntro += ` Am I speaking with ${contactName}?`;
    }

    // Filter valid script items (skip blanks)
    const items = (overrides.dataToCollect || campaign.dataToCollect || []).filter(item =>
      (item.itemType || 'question') === 'information' || (item.text && item.text.trim().length > 0)
    );

    const state = {
      phase:            'identity',
      currentIndex:     0,
      noAnswerRetries:  0,
      items,
      contactName,
      language,
      callSignOff:  overrides.goals?.callSignOff
                    || campaign.callModule?.callSignOff
                    || 'Thank you for your time. Goodbye.',
      campaignId:   campaign.id,
      tenantId:     campaign.tenantId,
      callLogId,
      contactId:    callLog.contactId,
      transcriptHistory: [],
      answers: []
    };

    pushTranscript(state, 'assistant', callIntro);
    await saveState(callSid, state);

    console.log(`[Gather] Call ${callSid} started — ${items.length} questions, language=${language}`);
    res.type('text/xml').send(buildGatherTwiML([], callIntro, language, NO_ANS_TIMEOUT, buildHints(items)));

  } catch (err) {
    console.error('[Gather] /answer error:', err);
    res.type('text/xml').send('<Response><Hangup/></Response>');
  }
});

// ══════════════════════════════════════════════════════════════════════
// POST /call/gather
// Twilio POSTs here with SpeechResult after the user speaks + 3s silence.
// Also fires with empty SpeechResult when actionOnEmptyResult=true.
// ══════════════════════════════════════════════════════════════════════

router.post('/gather', async (req, res) => {
  const callSid      = req.body.CallSid;
  const speechResult = (req.body.SpeechResult || '').trim();

  try {
    const state = await loadState(callSid);
    if (!state) return res.type('text/xml').send('<Response><Hangup/></Response>');

    const { language, items, callSignOff } = state;

    // Empty result → treat as no-input
    if (!speechResult) {
      return res.type('text/xml').send(
        '<Response><Redirect method="POST">/call/no-input</Redirect></Response>'
      );
    }

    pushTranscript(state, 'user', speechResult);
    console.log(`[Gather] ${callSid} | phase=${state.phase} | speech="${speechResult}"`);

    // ── Global: negative sentiment ────────────────────────────────────
    if (isNegative(speechResult)) {
      const msg = 'I apologize for the interruption. Have a great day.';
      pushTranscript(state, 'assistant', msg);
      state.phase = 'done';
      await saveState(callSid, state);
      return res.type('text/xml').send(buildSayHangupTwiML(msg, language));
    }

    // ── IDENTITY phase ────────────────────────────────────────────────
    if (state.phase === 'identity') {
      if (isDenial(speechResult)) {
        const msg = 'I apologize for the confusion. Have a great day.';
        pushTranscript(state, 'assistant', msg);
        state.phase = 'done';
        await saveState(callSid, state);
        return res.type('text/xml').send(buildSayHangupTwiML(msg, language));
      }
      // Any non-denial → identity confirmed, start questions
      state.phase           = 'questions';
      state.noAnswerRetries = 0;
      console.log(`[Gather] Identity confirmed for ${callSid}`);
      return respondWithNext(state, callSid, res, { isFirstQuestion: true });
    }

    // ── QUESTIONS phase ───────────────────────────────────────────────
    if (state.phase === 'questions') {
      // prevItem = question we just asked (currentIndex was pre-advanced past it)
      const prevItem = items[state.currentIndex - 1];

      if (prevItem && (prevItem.itemType || 'question') === 'question' && prevItem.onAnswer?.action) {
        const { action, skipCondition, skipToId } = prevItem.onAnswer;

        // Guard: don't fire end_call on partial/mid-sentence answers.
        // Twilio STT (like Deepgram) adds trailing punctuation to complete sentences.
        // "Yes. I" ends with "I" (partial) — defer. "No." ends with "." — fire.
        const answerIsComplete  = /[.?!]$/.test(speechResult.trimEnd());
        const deferEndCall      = (action === 'end_call') && !answerIsComplete;

        if (!deferEndCall) {
          const conditionFired = evalCondition(
            skipCondition?.condition,
            skipCondition?.value,
            speechResult
          );
          console.log(`[Gather] Condition "${skipCondition?.condition} '${skipCondition?.value}'" → ${conditionFired}`);

          if (conditionFired) {
            if (action === 'end_call') {
              pushTranscript(state, 'assistant', callSignOff);
              state.phase = 'done';
              await saveState(callSid, state);
              return res.type('text/xml').send(buildSayHangupTwiML(callSignOff, language));
            }
            if (action === 'skip_question' && skipToId) {
              const targetIdx = items.findIndex(i => i.id === skipToId);
              if (targetIdx !== -1) {
                state.currentIndex = targetIdx;
                console.log(`[Gather] Skip → jumping to question index ${targetIdx}`);
              }
            }
          }
        } else {
          console.log(`[Gather] Deferring end_call — answer lacks trailing punct, likely partial: "${speechResult}"`);
        }
      }

      // Record answer for evaluation report
      if (prevItem) {
        (state.answers ??= []).push({
          questionId:   prevItem.id,
          questionText: prevItem.text,
          answer:       speechResult
        });
      }

      state.noAnswerRetries = 0;
      return respondWithNext(state, callSid, res);
    }

    // phase === 'done' (shouldn't happen, but guard)
    return res.type('text/xml').send('<Response><Hangup/></Response>');

  } catch (err) {
    console.error('[Gather] /gather error:', err);
    res.type('text/xml').send('<Response><Hangup/></Response>');
  }
});

// ══════════════════════════════════════════════════════════════════════
// POST /call/no-input
// Fires when the user doesn't speak at all within the timeout window.
// ══════════════════════════════════════════════════════════════════════

router.post('/no-input', async (req, res) => {
  const callSid = req.body.CallSid;

  try {
    const state = await loadState(callSid);
    if (!state) return res.type('text/xml').send('<Response><Hangup/></Response>');

    const { language, items, callSignOff, phase } = state;
    state.noAnswerRetries = (state.noAnswerRetries || 0) + 1;

    console.log(`[Gather] No-input ${callSid} — retry ${state.noAnswerRetries}/${MAX_RETRIES}, phase=${phase}`);

    // ── Identity phase: re-ask "Am I speaking with X?" ────────────────
    if (phase === 'identity') {
      if (state.noAnswerRetries <= MAX_RETRIES) {
        const retryText = `Are you still there? Am I speaking with ${state.contactName}?`;
        pushTranscript(state, 'assistant', retryText);
        await saveState(callSid, state);
        return res.type('text/xml').send(buildGatherTwiML([], retryText, language, NO_ANS_TIMEOUT, buildHints(items)));
      }
      // Exhausted — end the call
      pushTranscript(state, 'assistant', callSignOff);
      state.phase = 'done';
      await saveState(callSid, state);
      return res.type('text/xml').send(buildSayHangupTwiML(callSignOff, language));
    }

    // ── Questions phase ───────────────────────────────────────────────
    if (state.noAnswerRetries <= MAX_RETRIES) {
      // Re-ask the last question verbatim with a "are you still there?" prompt.
      // currentIndex was pre-advanced when the question was sent, so lastAsked = currentIndex - 1.
      const lastAsked = items[state.currentIndex - 1];
      if (!lastAsked) {
        state.phase = 'done';
        await saveState(callSid, state);
        return res.type('text/xml').send(buildSayHangupTwiML(callSignOff, language));
      }
      const qText    = lastAsked.text.replace(/\[([^\]]+)\]/g, '$1');
      const retryText = `Are you still there? ${qText}`;
      pushTranscript(state, 'assistant', retryText);
      await saveState(callSid, state);
      return res.type('text/xml').send(buildGatherTwiML([], retryText, language, NO_ANS_TIMEOUT, buildHints(items)));
    }

    // Retries exhausted — skip to the next question
    // currentIndex is already past the unanswered question (was pre-advanced when sent)
    state.noAnswerRetries = 0;
    return respondWithNext(state, callSid, res);

  } catch (err) {
    console.error('[Gather] /no-input error:', err);
    res.type('text/xml').send('<Response><Hangup/></Response>');
  }
});

// ══════════════════════════════════════════════════════════════════════
// POST /call/status
// Twilio status callback — fires when the call reaches a terminal state.
// Saves the transcript and queues the evaluation report.
// ══════════════════════════════════════════════════════════════════════

router.post('/status', async (req, res) => {
  const { CallSid: callSid, CallStatus: callStatus } = req.body;
  res.sendStatus(200); // ack immediately so Twilio doesn't retry

  const TERMINAL = ['completed', 'busy', 'failed', 'no-answer', 'canceled'];
  if (!TERMINAL.includes(callStatus)) return;

  try {
    const state = await loadState(callSid);
    if (!state) {
      console.log(`[Gather] /status: no state found for ${callSid} (already processed?)`);
      return;
    }

    const { callLogId, campaignId, tenantId, transcriptHistory, contactName } = state;

    const header     = `[Twilio_SID:${callSid}]\n\n`;
    const body       = transcriptHistory?.length > 0
      ? transcriptHistory.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
      : '[No speech detected]';
    const transcript = header + body;

    if (callLogId) {
      const current = await prisma.callLog.findUnique({
        where: { id: callLogId }, select: { status: true }
      });
      const data = { transcript };
      if (current?.status === 'in-progress') data.status = 'completed';
      await prisma.callLog.update({ where: { id: callLogId }, data });
      console.log(`[Gather] Transcript saved for ${callLogId}`);
    }

    if (callLogId && campaignId && tenantId) {
      const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { name: true, dataToCollect: true, callSettings: true }
      });
      await publishEvaluation(tenantId, {
        callLogId,
        campaignId,
        tenantId,
        contactName,
        transcript,
        campaignName:      campaign?.name,
        dataToCollect:     campaign?.dataToCollect ?? [],
        reportWebhook:     campaign?.callSettings?.reportWebhook ?? null,
        identityConfirmed: state.phase !== 'identity'
      });
      console.log(`[Gather] Queued eval for ${callLogId}`);
    }

    await redis.del(stateKey(callSid));
    console.log(`[Gather] Call ${callSid} finalized (${callStatus}) — state cleared`);

  } catch (err) {
    console.error('[Gather] /status error:', err);
  }
});

// ══════════════════════════════════════════════════════════════════════
// POST /call/recording
// Optional: Twilio recording status callback.
// Fires when the recording MP3 is ready — updates recordingUrl on callLog.
// ══════════════════════════════════════════════════════════════════════

router.post('/recording', async (req, res) => {
  res.sendStatus(200);
  const { CallSid, RecordingUrl, RecordingDuration, RecordingStatus } = req.body;
  if (RecordingStatus !== 'completed') return;

  try {
    const recordingUrl = `${RecordingUrl}.mp3`;
    const durationMs   = parseInt(RecordingDuration || '0', 10) * 1000;

    // Find the callLog by providerRef (Twilio SID)
    const callLog = await prisma.callLog.findFirst({
      where: { providerRef: CallSid }, select: { id: true }
    });
    if (!callLog) return;

    await prisma.callLog.update({
      where: { id: callLog.id },
      data:  { recordingUrl, durationMs }
    });
    console.log(`[Gather] Recording ready for ${CallSid} — ${recordingUrl}`);
  } catch (err) {
    console.error('[Gather] /recording error:', err);
  }
});

export { router as twilioGatherRouter };
