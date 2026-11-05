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
 * Reply: { reply, endCall: null | { reason, closingLine } }
 */

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 2000;
const TIMEOUT_MS = 30000;
// Tried in order, like campaign drafting: the next model is used when one is
// overloaded, retired or rate-limited.
const MODELS = (process.env.GEMINI_TRY_CHAT_MODELS || process.env.GEMINI_DRAFT_MODELS || 'gemini-3.8-flash,gemini-3.5-flash')
  .split(',').map(m => m.trim()).filter(Boolean);
const TRY_NEXT_MODEL = new Set([404, 429, 500, 503]);

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
    tools: [{ functionDeclarations: [END_CALL_TOOL] }],
  };
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

  const request = JSON.stringify(buildTryChatRequest(parsed));
  let response;
  let model;
  for (const candidate of MODELS) {
    model = candidate;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: request,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (model !== MODELS.at(-1)) continue;
      console.error('[tryChat] Gemini unreachable:', err.message);
      return res.status(504).json({ error: 'Could not reach the test agent. Try again in a moment.' });
    }
    if (response.ok || !TRY_NEXT_MODEL.has(response.status)) break;
    console.warn(`[tryChat] ${model} answered ${response.status}; trying the next model`);
  }

  if (!response.ok) {
    console.error('[tryChat] Gemini error:', response.status, (await response.text()).slice(0, 300));
    if (response.status === 429) return res.status(429).json({ error: 'Too many test messages at once. Wait a moment.' });
    return res.status(502).json({ error: 'The test agent did not answer. Try again.' });
  }

  const data = await response.json();
  const meta = data?.usageMetadata || {};
  await recordAiUsage({
    tenantId: req.user?.workspaceId, userId: req.user?.id, feature: 'campaign_try_chat',
    provider: 'gemini', model,
    inputTokens: meta.promptTokenCount || 0,
    outputTokens: (meta.candidatesTokenCount || 0) + (meta.thoughtsTokenCount || 0),
    success: true,
  });

  const result = readTryChatReply(data, parsed.payload);
  if (!result.reply && !result.endCall) {
    return res.status(502).json({ error: 'The test agent gave an empty answer. Send your message again.' });
  }
  return res.json(result);
};
