import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

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

function hasCredentials() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
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

  if (!hasCredentials()) {
    // Named precisely so an operator knows exactly what to set. The manual
    // builder is unaffected, which is why this is a soft failure.
    return res.status(503).json({
      error: 'Drafting is not configured on this server. Set ANTHROPIC_API_KEY to enable it — you can still build the campaign manually.',
      code: 'DRAFTING_UNAVAILABLE',
    });
  }

  try {
    const response = await getClient().messages.parse({
      model: 'claude-opus-5',
      max_tokens: 16000,
      // Weighting a question set, ordering it for conversational flow and
      // deriving branching from prose is genuine reasoning, not extraction.
      thinking: { type: 'adaptive' },
      system: SYSTEM,
      messages: [{ role: 'user', content: brief.trim() }],
      output_config: { format: zodOutputFormat(DraftSchema) },
    });

    // A policy decline arrives as HTTP 200 — check before reading content.
    if (response.stop_reason === 'refusal') {
      console.warn('[draft] declined:', response.stop_details);
      return res.status(422).json({
        error: 'This brief was declined. Rephrase it, or build the campaign manually.',
      });
    }

    if (!response.parsed_output) {
      console.error('[draft] no parsed output; stop_reason =', response.stop_reason);
      return res.status(502).json({ error: 'The draft came back unreadable. Try again.' });
    }

    const result = toWizardPayload(response.parsed_output);
    const questionCount = result.payload.dataToCollect.filter(i => i.itemType === 'question').length;
    console.log(`[draft] drafted "${result.payload.name}" — ${questionCount} questions`);

    return res.json(result);
  } catch (err) {
    // Most-specific first: a bad key and a rate limit need different fixes.
    if (err instanceof Anthropic.AuthenticationError) {
      console.error('[draft] auth rejected:', err.message);
      return res.status(503).json({
        error: 'Drafting credentials were rejected. Check ANTHROPIC_API_KEY.',
        code: 'DRAFTING_UNAVAILABLE',
      });
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'Too many drafts at once. Try again in a moment.' });
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return res.status(504).json({ error: 'Could not reach the drafting service. Check your connection.' });
    }
    console.error('[draft] failed:', err);
    return res.status(500).json({ error: 'Could not draft this campaign. Build it manually, or try again.' });
  }
}
