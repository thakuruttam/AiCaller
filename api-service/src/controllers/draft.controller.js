import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { recordAiUsage } from '../services/aiUsage.service.js';

/**
 * POST /api/campaigns/draft
 *
 * Turns a plain-language brief into a complete campaign configuration:
 * questions with weights, expected answers, branching, the opening line and
 * the sign-off.
 *
 * Why this exists: creating a campaign used to mean a human hand-authoring
 * six questions, assigning weight percentages that must total 100, and
 * picking comparison operators out of dropdowns — across five wizard
 * screens. The product already runs a model on every call; asking the
 * operator to do that authoring by hand was work the product could do.
 *
 * What this is NOT: it does not create anything. It returns a draft the
 * caller reviews and edits, and the existing POST /api/campaigns/wizard
 * still does the writing. So a bad draft costs a correction, never a
 * surprise campaign — and the manual builder remains fully usable if this
 * endpoint is unavailable.
 */

// The shape the wizard already speaks (see frontend questionModel.js and
// createWizardCampaign). Constraining the model to this exact schema means
// the response either validates or fails loudly — it can never half-fill
// a campaign.
const CONDITIONS = [
  'contains', 'does not contain', 'equals', 'starts with', 'ends with',
  'is greater than', 'is less than', 'is any value',
];

const ExpectedAnswer = z.object({
  condition: z.enum([...CONDITIONS, 'is_true', 'is_false']),
  value: z.string(),
});

const Item = z.object({
  // 'information' is a statement the agent reads out; it has no answer and
  // carries no weight.
  itemType: z.enum(['question', 'information']),
  text: z.string(),
  is_mandatory: z.boolean(),
  weight: z.number(),
  expectedAnswer: ExpectedAnswer,
  // Plain-English scoring, used instead of expectedAnswer when the rule is
  // judgement rather than string matching.
  scoringCriteria: z.string(),
  scoringActiveTab: z.enum(['condition', 'semantic']),
  onAnswerAction: z.enum(['continue', 'skip_question', 'end_call']),
  // 1-based position of the item to jump to; 0 when not skipping. An index
  // rather than an id, because the model cannot know ids we haven't minted.
  skipToIndex: z.number(),
  skipCondition: ExpectedAnswer,
  skipSemanticCondition: z.string(),
  skipConditionActiveTab: z.enum(['condition', 'semantic']),
});

const DraftSchema = z.object({
  name: z.string(),
  type: z.enum(['HR', 'RECRUITER', 'SALES', 'LOAN_RECOVERY', 'FEEDBACK']),
  language: z.enum(['English', 'Hindi', 'Hinglish']),
  goal: z.string(),
  callIntro: z.string(),
  callSignOff: z.string(),
  endCallIf: z.string(),
  maxDurationMinutes: z.number(),
  retryAttempts: z.number(),
  items: z.array(Item),
  // The model's own account of what it inferred rather than read, shown to
  // the operator so review is informed instead of a rubber stamp.
  assumptions: z.array(z.string()),
});

const SYSTEM = `You design outbound phone-call campaigns for an AI voice agent that calls people in India.

Turn the operator's brief into a complete, immediately runnable campaign. You are drafting for review — be decisive and specific rather than generic, because a vague draft costs the operator more work than no draft.

RULES
1. Questions must be short enough to be said out loud naturally on a phone call. One idea per question. No compound questions joined by "and".
2. Order questions the way a real conversation flows: easy and factual first, sensitive ones (money, notice period, personal circumstances) later.
3. Weights must total exactly 100 across items of type "question". Weight by how much the answer matters to the operator's stated decision, not evenly. Items of type "information" always have weight 0.
4. Use "information" for anything the agent should state rather than ask.
5. expectedAnswer vs scoringCriteria — pick ONE per question and set scoringActiveTab accordingly:
   - "condition" + expectedAnswer for a checkable fact (a number, a named thing, yes/no). Use is_true/is_false for yes-or-no questions.
   - "semantic" + scoringCriteria for judgement ("describes relevant hands-on experience"). Leave the unused one at condition "is any value" with an empty value.
6. Branching: set onAnswerAction to "skip_question" with skipToIndex, or "end_call", only where the brief actually implies it. Default to "continue". Never skip backwards.
7. callIntro must contain the literal token [Name] where the person's name belongs, and must not ask the identity question — the system appends that itself.
8. endCallIf is a single plain-English condition for abandoning the call early. Empty string if the brief implies none.
9. Infer language from the brief; default to English. Hinglish only if the brief suggests a Hindi-speaking audience.
10. List every genuine inference in "assumptions" — a weighting you chose, a branch you inferred, a question the brief implied but did not state. Do not list things the brief said explicitly. This is what the operator checks first, so be honest about what you invented.`;

let client = null;
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

// Gemini drafts whenever its key is set (the server already holds one for voice previews);
// Anthropic is used only on a server that has no Gemini key.
// Tried in order: the next model is used when one is overloaded (503), retired (404) or
// rate-limited (429). gemini-2.5-flash was retired for new keys in Nov 2026. Comma-separated
// GEMINI_DRAFT_MODELS overrides the list.
const GEMINI_DRAFT_MODELS = (process.env.GEMINI_DRAFT_MODELS || 'gemini-3.8-flash,gemini-3.5-flash')
  .split(',').map(m => m.trim()).filter(Boolean);
const GEMINI_TRY_NEXT_MODEL = new Set([404, 429, 500, 503]);
const GEMINI_TIMEOUT_MS = 90000;

function draftProvider() {
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return 'anthropic';
  return null;
}

/** A failure that maps straight to an HTTP response. `usage` is set when the model already ran (and billed). */
class DraftError extends Error {
  constructor(status, body, usage = null) {
    super(body.error);
    this.status = status;
    this.body = body;
    this.usage = usage;
  }
}

// Gemini's structured output takes plain JSON Schema; the same zod schema keeps both providers
// to one shape. $schema is metadata Gemini doesn't accept.
function geminiResponseSchema() {
  const { $schema, ...schema } = z.toJSONSchema(DraftSchema);
  return schema;
}

async function callGemini(model, brief) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: brief }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: geminiResponseSchema() },
    }),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });
}

async function draftWithGemini(brief) {
  let response;
  let model;
  for (const candidate of GEMINI_DRAFT_MODELS) {
    model = candidate;
    try {
      response = await callGemini(model, brief);
    } catch (err) {
      console.error('[draft] Gemini unreachable:', err.message);
      throw new DraftError(504, { error: 'Could not reach the drafting service. Check your connection.' });
    }
    if (response.ok || !GEMINI_TRY_NEXT_MODEL.has(response.status)) break;
    console.warn(`[draft] ${model} answered ${response.status}; trying the next model`);
  }

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    console.error('[draft] Gemini error:', response.status, detail);
    if (response.status === 401 || response.status === 403) {
      throw new DraftError(503, { error: 'Drafting credentials were rejected. Check GEMINI_API_KEY.', code: 'DRAFTING_UNAVAILABLE' });
    }
    if (response.status === 429) throw new DraftError(429, { error: 'Too many drafts at once. Try again in a moment.' });
    throw new DraftError(502, { error: 'Could not draft this campaign. Build it manually, or try again.' });
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];
  const meta = data?.usageMetadata || {};
  // Gemini bills thinking tokens as output
  const usage = {
    provider: 'gemini', model,
    inputTokens: meta.promptTokenCount || 0,
    outputTokens: (meta.candidatesTokenCount || 0) + (meta.thoughtsTokenCount || 0),
  };
  // A safety block arrives as HTTP 200 — check before reading content.
  if (data?.promptFeedback?.blockReason || candidate?.finishReason === 'SAFETY' || candidate?.finishReason === 'PROHIBITED_CONTENT') {
    console.warn('[draft] declined:', data?.promptFeedback?.blockReason || candidate?.finishReason);
    throw new DraftError(422, { error: 'This brief was declined. Rephrase it, or build the campaign manually.' }, usage);
  }

  const text = (candidate?.content?.parts || []).map(part => part.text || '').join('');
  let parsed;
  try {
    parsed = DraftSchema.safeParse(JSON.parse(text));
  } catch {
    parsed = { success: false };
  }
  if (!parsed.success) {
    console.error('[draft] Gemini output did not match the schema; finishReason =', candidate?.finishReason);
    throw new DraftError(502, { error: 'The draft came back unreadable. Try again.' }, usage);
  }
  return { draft: parsed.data, usage };
}

async function draftWithAnthropic(brief) {
  let response;
  try {
    response = await getClient().messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      // Weighting a question set, ordering it for conversational flow and
      // deriving branching from prose is genuine reasoning, not extraction.
      thinking: { type: 'adaptive' },
      system: SYSTEM,
      messages: [{ role: 'user', content: brief }],
      output_config: { format: zodOutputFormat(DraftSchema) },
    });
  } catch (err) {
    // Most-specific first: a bad key and a rate limit need different fixes.
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('[draft] auth rejected:', err.message);
      throw new DraftError(503, { error: 'Drafting credentials were rejected. Check ANTHROPIC_API_KEY.', code: 'DRAFTING_UNAVAILABLE' });
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new DraftError(429, { error: 'Too many drafts at once. Try again in a moment.' });
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new DraftError(504, { error: 'Could not reach the drafting service. Check your connection.' });
    }
    throw err;
  }

  const usage = {
    provider: 'anthropic', model: 'claude-opus-5-5',
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
  };
  // A policy decline arrives as HTTP 200 — check before reading content.
  if (response.stop_reason === 'refusal') {
    console.warn('[draft] declined:', response.stop_details);
    throw new DraftError(422, { error: 'This brief was declined. Rephrase it, or build the campaign manually.' }, usage);
  }
  if (!response.parsed_output) {
    console.error('[draft] no parsed output; stop_reason =', response.stop_reason);
    throw new DraftError(502, { error: 'The draft came back unreadable. Try again.' }, usage);
  }
  return { draft: response.parsed_output, usage };
}

/**
 * Convert the model's draft into the exact payload the wizard holds in
 * state, and enforce the invariants the UI relies on. The model is
 * constrained by schema, but schema can't express "weights total 100" or
 * "skip targets point forward" — so those are checked here and corrected
 * rather than trusted.
 */
function toWizardPayload(draft) {
  const notes = [];

  const items = (draft.items || []).map((item, i) => ({
    id: Math.random().toString(36).slice(2, 9),
    order: i,
    itemType: item.itemType,
    text: (item.text || '').trim(),
    is_mandatory: !!item.is_mandatory,
    weight: item.itemType === 'question' ? Math.max(0, Math.round(item.weight || 0)) : 0,
    // Marks every weight as deliberate so the wizard's auto-balancer leaves
    // the drafted distribution alone instead of flattening it.
    isWeightManuallySet: true,
    expectedAnswer: {
      condition: item.expectedAnswer?.condition || 'is any value',
      value: item.expectedAnswer?.value || '',
    },
    scoringCriteria: item.scoringCriteria || '',
    scoringActiveTab: item.scoringActiveTab === 'semantic' ? 'semantic' : 'condition',
    onAnswer: {
      action: item.onAnswerAction || 'continue',
      skipToId: '',
      skipConditionActiveTab: item.skipConditionActiveTab === 'semantic' ? 'semantic' : 'condition',
      skipCondition: {
        condition: item.skipCondition?.condition || 'contains',
        value: item.skipCondition?.value || '',
      },
      skipSemanticCondition: item.skipSemanticCondition || '',
    },
    fieldsToExtract: [],
  })).filter(item => item.text.length > 0);

  // Resolve skip targets now that ids exist. 1-based in the model's output;
  // anything out of range or pointing backwards becomes a plain continue,
  // because a dangling skip silently strands callers mid-script.
  draft.items?.forEach((raw, i) => {
    const item = items[i];
    if (!item || item.onAnswer.action !== 'skip_question') return;
    const target = items[(raw.skipToIndex || 0) - 1];
    if (target && (raw.skipToIndex - 1) > i) {
      item.onAnswer.skipToId = target.id;
    } else {
      item.onAnswer.action = 'continue';
      notes.push(`Dropped an invalid skip rule on "${item.text.slice(0, 40)}…".`);
    }
  });

  // Weights must total 100 or the wizard refuses to advance. Correct the
  // largest-weighted question by the difference rather than rescaling
  // everything, which would churn every number the operator is reading.
  const questions = items.filter(i => i.itemType === 'question');
  const total = questions.reduce((s, q) => s + q.weight, 0);
  if (questions.length && total !== 100) {
    const biggest = questions.reduce((a, b) => (b.weight > a.weight ? b : a));
    biggest.weight = Math.max(0, biggest.weight + (100 - total));
    notes.push(`Adjusted one weight so the total reaches 100% (was ${total}%).`);
  }

  return {
    payload: {
      name: draft.name || 'Untitled campaign',
      type: draft.type || 'HR',
      prompt: '',
      goals: {
        goal: draft.goal || '',
        callIntro: draft.callIntro || '',
        callSignOff: draft.callSignOff || '',
      },
      dataToCollect: items,
      endCallIf: draft.endCallIf || '',
      rules: { successScore: 50, list: [], fieldsToExtract: [], scoringRules: [] },
      callSettings: {
        tone: 'Professional',
        language: draft.language || 'English',
        voice: 'marin',
        geminiVoice: 'Kore',
        maxDuration: Math.min(60, Math.max(1, Math.round(draft.maxDurationMinutes || 5))),
        retryAttempts: Math.min(5, Math.max(0, Math.round(draft.retryAttempts ?? 2))),
      },
    },
    assumptions: draft.assumptions || [],
    corrections: notes,
  };
}

export async function draftCampaign(req, res) {
  const { brief } = req.body || {};

  if (!brief || typeof brief !== 'string' || brief.trim().length < 20) {
    return res.status(400).json({
      error: 'Describe who you are calling and what you need to find out — a sentence or two is enough.',
    });
  }

  const provider = draftProvider();
  if (!provider) {
    // Named precisely so an operator knows exactly what to set. The manual
    // builder is unaffected, which is why this is a soft failure.
    return res.status(503).json({
      error: 'Drafting is not configured on this server. Set GEMINI_API_KEY to enable it — you can still build the campaign manually.',
      code: 'DRAFTING_UNAVAILABLE',
    });
  }

  // Every model call costs money, so it is recorded for the Usage page — including ones whose
  // output we then reject.
  const track = (usage, success) => usage && recordAiUsage({
    tenantId: req.user?.workspaceId, userId: req.user?.id, feature: 'campaign_draft', success, ...usage,
  });

  try {
    const { draft, usage } = provider === 'gemini' ? await draftWithGemini(brief.trim()) : await draftWithAnthropic(brief.trim());
    await track(usage, true);
    const result = toWizardPayload(draft);
    const questionCount = result.payload.dataToCollect.filter(i => i.itemType === 'question').length;
    console.log(`[draft] drafted "${result.payload.name}" with ${provider} — ${questionCount} questions`);

    return res.json(result);
  } catch (err) {
    await track(err.usage, false);
    if (err instanceof DraftError) return res.status(err.status).json(err.body);
    console.error('[draft] failed:', err);
    return res.status(500).json({ error: 'Could not draft this campaign. Build it manually, or try again.' });
  }
}
