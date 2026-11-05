import { recordAiUsage } from '../services/aiUsage.service.js';
import { buildConversationInstructions, CONVERSATION_END_REASONS } from '../utils/conversationPrompt.js';

/**
 * POST /api/campaigns/try-chat — the campaign builder's "Try it" panel.
 *
 * Plays the caller against a conversation campaign that may not be saved yet:
 * the body carries the campaign as the builder currently has it, plus the chat
 * so far. The agent gets the same instructions and the same end_call tool a
 * live call gets (utils/conversationPrompt.js is shared with
 * telephony-gateway), so the test chat behaves like a real call — only typed,
 * and on a cheaper text model.
 *
 * Body: { payload: { goals, conversation, endCallIf, callSettings },
 *         contactName?, messages: [{ role: 'user' | 'assistant', text }] }
 * Reply: { reply, endCall: null | { reason, closingLine }, captured: { [detail]: value } }
 */

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 2000;
// A chat turn should feel instant: a model that hasn't answered in 8s is
// treated as overloaded and the next one is tried. (Nov 2026: this key's
// gemini-3.5-flash quota is exhausted — 429 at once — so 3.8 goes first.)
const TIMEOUT_MS = 8000;
const MODELS = (process.env.GEMINI_TRY_CHAT_MODELS || 'gemini-3.8-flash,gemini-3.5-flash')
  .split(',').map(m => m.trim()).filter(Boolean);
// capture_detail turns carry no speech, so the model is asked again for its
// reply, and an empty answer (gemini-3.8-flash sometimes returns no parts on
// a long prompt) is retried; this caps how many times one message can go round.
const MAX_TOOL_ROUNDS = 3;
const TRY_NEXT_MODEL = new Set([404, 429, 500, 503]);

const CAPTURE_DETAIL_TOOL = {
  name: 'capture_detail',
  description: "Call each time the caller gives one of the DETAILS TO COLLECT, with the detail's name exactly as listed and their answer.",
  parameters: {
    type: 'object',
    properties: { name: { type: 'string' }, value: { type: 'string' } },
    required: ['name', 'value'],
  },
};

const END_CALL_TOOL = {
  name: 'end_call',
  description: 'Call when the conversation should end, with the reason it ended. Call it without speaking any goodbye yourself: the closing line is played automatically.',
  parameters: {
    type: 'object',
    properties: { reason: { type: 'string', enum: CONVERSATION_END_REASONS } },
    required: ['reason'],
  },
};

// Mirrors plivoStreamHandler.js's end_call handling.
const APOLOGY_REASONS = new Set(['busy', 'wrong_person']);
const APOLOGY_LINE = 'I apologize for the interruption. Have a great day.';

/** Validates the body; returns { error } or the cleaned pieces. */
export function readTryChatBody(body) {
  const payload = body?.payload;
  if (!payload || typeof payload !== 'object') return { error: 'Send the campaign as `payload`.' };
  const messages = Array.isArray(body.messages) ? body.messages : null;
  if (!messages) return { error: 'Send the chat so far as `messages`.' };
  if (messages.length > MAX_MESSAGES) return { error: `A test chat is limited to ${MAX_MESSAGES} messages — start a new one.` };
  const cleaned = [];
  for (const m of messages) {
    const text = String(m?.text ?? '').trim();
    if (!['user', 'assistant'].includes(m?.role) || !text) return { error: 'Each message needs a role (user or assistant) and some text.' };
    cleaned.push({ role: m.role, text: text.slice(0, MAX_MESSAGE_CHARS) });
  }
  if (cleaned.at(-1)?.role !== 'user') return { error: 'The last message must be from you, the caller.' };
  return { payload, messages: cleaned, contactName: String(body.contactName || '').trim().slice(0, 80) || 'Alex' };
}

/** The full Gemini request for one test turn. Exported for tests. */
export function buildTryChatRequest({ payload, messages, contactName }) {
  const maxMinutes = Number(payload.callSettings?.maxDuration) || null;
  const instructions = buildConversationInstructions({
    contactName,
    objective: payload.goals?.goal,
    conversation: payload.conversation,
    endCallIf: payload.endCallIf,
    maxMinutes,
  });
  const intro = String(payload.goals?.callIntro || '').replace(/\[Name\]/gi, contactName).trim();
  const note = `This is a typed test of the call: the caller's messages are typed, not spoken. The call opened with your greeting${intro ? `: "${intro} Am I speaking with ${contactName}?"` : '.'}`;
  return {
    systemInstruction: { parts: [{ text: `${instructions}\n\n${note}` }] },
    contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text }] })),
    tools: [{ functionDeclarations: [CAPTURE_DETAIL_TOOL, END_CALL_TOOL] }],
    // Same low temperature as a live conversation call, so the test behaves alike.
    generationConfig: { temperature: Number(process.env.GEMINI_CONVERSATION_TEMPERATURE ?? 0.3) },
  };
}

/**
 * The details a reply captured, keeping only ones the campaign asked for
 * (matched case-insensitively, stored under the configured name) — mirrors
 * VoiceAgent.recordDetail.
 */
export function readCapturedDetails(parts, payload) {
  const wanted = (payload.conversation?.detailsToCollect || []).map(d => String(d).trim()).filter(Boolean);
  const captured = {};
  for (const p of parts) {
    if (p.functionCall?.name !== 'capture_detail') continue;
    const key = wanted.find(d => d.toLowerCase() === String(p.functionCall.args?.name || '').trim().toLowerCase());
    const value = String(p.functionCall.args?.value ?? '').trim().slice(0, 500);
    if (key && value) captured[key] = value;
  }
  return captured;
}

/** Reads a Gemini reply into { reply, endCall }. Exported for tests. */
export function readTryChatReply(data, payload) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const reply = parts.filter(p => p.text && !p.thought).map(p => p.text).join('').trim();
  const call = parts.find(p => p.functionCall?.name === 'end_call')?.functionCall;
  if (!call) return { reply, endCall: null };
  const reason = CONVERSATION_END_REASONS.includes(call.args?.reason) ? call.args.reason : 'objective_met';
  const closingLine = APOLOGY_REASONS.has(reason)
    ? APOLOGY_LINE
    : (payload.goals?.callSignOff?.trim() || 'Thank you for your time. Goodbye.');
  // A live call drops whatever the model said alongside end_call and plays
  // only the closing line (muteInFlight) — show the test the same way.
  return { reply: '', endCall: { reason, closingLine } };
}

export const tryChat = async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Test chats need GEMINI_API_KEY on the server.', code: 'TRY_CHAT_UNAVAILABLE' });
  }
  const parsed = readTryChatBody(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  const request = buildTryChatRequest(parsed);
  const captured = {};
  let result = null;
  for (let round = 0; round < MAX_TOOL_ROUNDS && !result; round += 1) {
    const turn = await callModel(request);
    if (turn.error) return res.status(turn.error.status).json({ error: turn.error.message });
    await recordAiUsage({
      tenantId: req.user?.workspaceId, userId: req.user?.id, feature: 'campaign_try_chat',
      provider: 'gemini', model: turn.model,
      inputTokens: turn.usage.promptTokenCount || 0,
      outputTokens: (turn.usage.candidatesTokenCount || 0) + (turn.usage.thoughtsTokenCount || 0),
      success: true,
    });
    const parts = turn.data?.candidates?.[0]?.content?.parts || [];
    if (!parts.length) {
      console.warn(`[tryChat] ${turn.model} returned an empty answer; asking again`);
      continue;
    }
    Object.assign(captured, readCapturedDetails(parts, parsed.payload));
    const read = readTryChatReply(turn.data, parsed.payload);
    if (read.reply || read.endCall) {
      result = read;
      break;
    }
    const calls = parts.filter(p => p.functionCall);
    if (!calls.length) break;
    // Only details were captured — answer the tool calls and ask again for
    // what the agent says next, the way the live call prompts a continuation.
    request.contents.push({ role: 'model', parts });
    request.contents.push({
      role: 'user',
      parts: calls.map(p => ({ functionResponse: { name: p.functionCall.name, response: { result: 'ok' } } })),
    });
  }

  if (!result) {
    return res.status(502).json({ error: 'The test agent gave an empty answer. Send your message again.' });
  }
  return res.json({ ...result, captured });
};

/** One generateContent call, falling through the model list. Resolves to { data, usage, model } or { error }. */
async function callModel(request) {
  const body = JSON.stringify(request);
  let response;
  let model;
  for (const candidate of MODELS) {
    model = candidate;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (model !== MODELS.at(-1)) {
        console.warn(`[tryChat] ${model} did not answer in ${TIMEOUT_MS / 1000}s; trying the next model`);
        continue;
      }
      console.error('[tryChat] Gemini unreachable:', err.message);
      return { error: { status: 504, message: 'Could not reach the test agent. Try again in a moment.' } };
    }
    if (response.ok || !TRY_NEXT_MODEL.has(response.status)) break;
    console.warn(`[tryChat] ${model} answered ${response.status}; trying the next model`);
  }
  if (!response.ok) {
    console.error('[tryChat] Gemini error:', response.status, (await response.text()).slice(0, 300));
    if (response.status === 429) return { error: { status: 429, message: 'Too many test messages at once. Wait a moment.' } };
    return { error: { status: 502, message: 'The test agent did not answer. Try again.' } };
  }
  const data = await response.json();
  return { data, usage: data?.usageMetadata || {}, model };
}
