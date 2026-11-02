// What a question does with its answer, in the terms an operator thinks in —
// "if they say no, end the call", "more than 2 years is a good answer" —
// translated to and from the fields the call engine and scorer actually read
// (expectedAnswer, scoringCriteria, onAnswer). Pure, so it can be tested
// without a DOM.
//
// Every question has an answer type. The type decides the possible answers,
// and each answer can carry two things: what happens next (carry on, end the
// call, jump ahead) and whether it's a good answer (what the call is scored
// on). Free-form questions have no fixed answers, so they get a described
// good answer and a described rule instead.
//
// Engine facts this file depends on:
// - Branch conditions on the "condition" tab are literal string/number
//   matches (telephony-gateway VoiceAgent.evalCondition). It has no case for
//   is_true / is_false, so a yes/no branch must be semantic to ever fire.
// - Semantic branch conditions are judged by an LLM that sees the condition
//   and the caller's answer, but not the question — so the condition text
//   names the question.
// - The scorer (call-evaluation-service scorer.js) understands is_true /
//   is_false and numeric 'is greater than' / 'is less than', including time
//   units ("2 years" vs "18 months").

const ANY = 'is any value';
const NUMERIC = ['is greater than', 'is less than'];
const YES_NO = ['is_true', 'is_false'];

export const ANSWER_TYPES = [
  { value: 'yesno', label: 'Yes or no', icon: 'thumbs_up_down' },
  { value: 'number', label: 'A number', icon: 'numbers' },
  { value: 'open', label: 'Their own words', icon: 'short_text' },
];

// Comparisons offered for free-form answers that were set up with an exact
// match (older campaigns, AI drafts). New free-form questions describe the
// good answer in words instead.
export const MATCH_CONDITIONS = [
  { value: 'contains', label: 'contains' },
  { value: 'does not contain', label: "doesn't contain" },
  { value: 'equals', label: 'is exactly' },
  { value: 'starts with', label: 'starts with' },
  { value: 'ends with', label: 'ends with' },
  { value: 'is greater than', label: 'is more than' },
  { value: 'is less than', label: 'is less than' },
  { value: 'is_true', label: 'means yes' },
  { value: 'is_false', label: 'means no' },
];

const isQuestion = (item) => (item.itemType || 'question') === 'question';
const clean = (s) => String(s ?? '').trim();
const yesNoWord = (s) => {
  const v = clean(s).toLowerCase();
  return v === 'yes' || v === 'no' ? v : null;
};

// ── Guessing a type from the words ──────────────────────────────────────────

const YES_NO_START = /^(are|is|do|does|did|have|has|had|can|could|will|would|should|shall|may|was|were|kya)\b/i;
const NUMBER_HINT = /^how (many|much|long|old|soon)\b|\b(ctc|salary|notice period|years of|budget|amount|scale of|age|how many)\b/i;

/** The answer type the words of a question suggest. */
export function guessAnswerType(text) {
  const t = clean(text);
  if (NUMBER_HINT.test(t)) return 'number';
  if (YES_NO_START.test(t)) return 'yesno';
  return 'open';
}

// ── Reading ─────────────────────────────────────────────────────────────────

// The text a yes/no branch condition is given. Recognised again on load, so
// the wording below and YES_NO_ROUTE must stay in step.
const yesNoCondition = (text, when) => (
  clean(text) ? `Their answer to “${clean(text)}” means ${when}` : `Their answer means ${when}`
);
const YES_NO_ROUTE = /means (yes|no)$/i;

/** Which kind of answer an existing scoring rule implies, if any. */
function scoreKind(item) {
  if (item.scoringActiveTab === 'semantic') return clean(item.scoringCriteria) ? 'open' : null;
  const { condition, value } = item.expectedAnswer || {};
  if (!condition || condition === ANY) return null;
  if (YES_NO.includes(condition)) return 'yesno';
  if (['equals', 'contains'].includes(condition) && yesNoWord(value)) return 'yesno';
  if (NUMERIC.includes(condition)) return 'number';
  return 'open';
}

/** Which kind of answer an existing branch implies, if any. */
function routeKind(item) {
  const oa = item.onAnswer || {};
  if (oa.action !== 'end_call' && oa.action !== 'skip_question') return null;
  if (oa.skipConditionActiveTab === 'condition') {
    const { condition, value } = oa.skipCondition || {};
    if (YES_NO.includes(condition)) return 'yesno';
    if (['equals', 'contains'].includes(condition) && yesNoWord(value)) return 'yesno';
    if (NUMERIC.includes(condition)) return 'number';
    return 'open';
  }
  return YES_NO_ROUTE.test(clean(oa.skipSemanticCondition)) ? 'yesno' : 'open';
}

/**
 * The answer type of a question, and where it came from: 'set' (chosen),
 * 'logic' (implied by rules it already has) or 'guess' (from its words, and
 * free to change as they're typed).
 */
export function answerTypeInfo(item) {
  if (ANSWER_TYPES.some(t => t.value === item.answerType)) return { type: item.answerType, source: 'set' };
  const s = scoreKind(item);
  const r = routeKind(item);
  if (s && r && s !== r) return { type: 'open', source: 'logic' };
  if (s || r) return { type: s || r, source: 'logic' };
  return { type: guessAnswerType(item.text), source: 'guess' };
}

export const answerTypeOf = (item) => answerTypeInfo(item).type;

const splitNumber = (raw) => {
  const m = clean(raw).match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
  return m ? { threshold: m[1], unit: m[2] } : { threshold: clean(raw), unit: '' };
};

/**
 * A question's answer handling, in operator terms:
 *   type       'yesno' | 'number' | 'open'
 *   good       yesno: 'yes' | 'no'; number: 'above' | 'below'; else null
 *   threshold, unit   number: what answers are compared with
 *   criteria   open: a described good answer ('' = any answer counts)
 *   match      open: an exact-match good answer, { condition, value } | null
 *   route      null, or { when, action: 'end_call' | 'skip_question', skipToId,
 *              text (open: when, in words), condition (open: exact match) }
 */
export function readLogic(item) {
  const type = answerTypeOf(item);
  const ea = item.expectedAnswer || {};
  const oa = item.onAnswer || {};
  const semanticScore = item.scoringActiveTab === 'semantic';
  const hasRoute = oa.action === 'end_call' || oa.action === 'skip_question';
  const logic = { type, good: null, threshold: '', unit: '', criteria: '', match: null, route: null };
  const routeBase = hasRoute ? { action: oa.action, skipToId: oa.skipToId || '' } : null;

  if (type === 'yesno') {
    if (!semanticScore) {
      if (ea.condition === 'is_true') logic.good = 'yes';
      else if (ea.condition === 'is_false') logic.good = 'no';
      else if (['equals', 'contains'].includes(ea.condition)) logic.good = yesNoWord(ea.value);
    }
    if (routeBase) {
      const sc = oa.skipCondition || {};
      let when = oa.when === 'yes' || oa.when === 'no' ? oa.when : null;
      if (!when && oa.skipConditionActiveTab === 'condition') {
        when = sc.condition === 'is_true' ? 'yes' : sc.condition === 'is_false' ? 'no' : yesNoWord(sc.value);
      }
      if (!when) when = clean(oa.skipSemanticCondition).match(YES_NO_ROUTE)?.[1]?.toLowerCase();
      logic.route = { ...routeBase, when: when || 'no' };
    }
    return logic;
  }

  if (type === 'number') {
    const from = NUMERIC.includes(ea.condition) ? ea.value
      : NUMERIC.includes(oa.skipCondition?.condition) ? oa.skipCondition.value : '';
    const split = splitNumber(from);
    logic.threshold = item.threshold != null ? clean(item.threshold) : split.threshold;
    logic.unit = item.thresholdUnit != null ? clean(item.thresholdUnit) : split.unit;
    if (!semanticScore && NUMERIC.includes(ea.condition)) {
      logic.good = ea.condition === 'is greater than' ? 'above' : 'below';
    }
    if (routeBase) {
      const c = oa.skipCondition?.condition;
      const when = oa.when === 'above' || oa.when === 'below' ? oa.when : c === 'is less than' ? 'below' : 'above';
      logic.route = { ...routeBase, when };
    }
    return logic;
  }

  // Free-form.
  if (semanticScore) logic.criteria = item.scoringCriteria || '';
  else if (ea.condition && ea.condition !== ANY) logic.match = { condition: ea.condition, value: ea.value ?? '' };
  if (routeBase) {
    logic.route = {
      ...routeBase,
      when: 'custom',
      text: oa.skipSemanticCondition || '',
      condition: oa.skipConditionActiveTab === 'condition'
        ? { condition: oa.skipCondition?.condition || 'contains', value: oa.skipCondition?.value ?? '' }
        : null,
    };
  }
  return logic;
}

// ── Writing ─────────────────────────────────────────────────────────────────

const NO_ROUTE = {
  action: 'continue',
  skipToId: '',
  skipConditionActiveTab: 'semantic',
  skipCondition: { condition: 'contains', value: '' },
  skipSemanticCondition: '',
};

/** Store `logic` (the shape readLogic returns) on the item. */
export function writeLogic(item, logic) {
  const { type, good, route } = logic;
  const next = { ...item, answerType: type };
  delete next.threshold;
  delete next.thresholdUnit;
  const routeFields = route
    ? { action: route.action, skipToId: route.action === 'skip_question' ? route.skipToId || '' : '' }
    : null;

  if (type === 'yesno') {
    next.scoringActiveTab = 'condition';
    next.scoringCriteria = '';
    next.expectedAnswer = { condition: good === 'yes' ? 'is_true' : good === 'no' ? 'is_false' : ANY, value: '' };
    next.onAnswer = route
      ? { ...NO_ROUTE, ...routeFields, when: route.when, skipSemanticCondition: yesNoCondition(item.text, route.when) }
      : { ...NO_ROUTE };
    return next;
  }

  if (type === 'number') {
    const threshold = clean(logic.threshold);
    const unit = clean(logic.unit);
    const value = [threshold, unit].filter(Boolean).join(' ');
    const op = (side) => (side === 'below' ? 'is less than' : 'is greater than');
    next.threshold = threshold;
    next.thresholdUnit = unit;
    next.scoringActiveTab = 'condition';
    next.scoringCriteria = '';
    next.expectedAnswer = good ? { condition: op(good), value } : { condition: ANY, value: '' };
    next.onAnswer = route
      ? {
        ...NO_ROUTE,
        ...routeFields,
        when: route.when,
        skipConditionActiveTab: 'condition',
        skipCondition: { condition: op(route.when), value },
      }
      : { ...NO_ROUTE };
    return next;
  }

  // Free-form. Any described good answer — even one still being typed — makes
  // the AI judge; clearing the description means any answer counts.
  if (logic.criteria) {
    next.scoringActiveTab = 'semantic';
    next.scoringCriteria = logic.criteria;
    next.expectedAnswer = { condition: ANY, value: '' };
  } else if (logic.match) {
    next.scoringActiveTab = 'condition';
    next.scoringCriteria = '';
    next.expectedAnswer = { condition: logic.match.condition, value: logic.match.value ?? '' };
  } else {
    next.scoringActiveTab = 'condition';
    next.scoringCriteria = '';
    next.expectedAnswer = { condition: ANY, value: '' };
  }
  next.onAnswer = !route ? { ...NO_ROUTE }
    : route.condition
      ? { ...NO_ROUTE, ...routeFields, when: 'custom', skipConditionActiveTab: 'condition', skipCondition: { ...route.condition } }
      : { ...NO_ROUTE, ...routeFields, when: 'custom', skipSemanticCondition: route.text ?? '' };
  return next;
}

/** Apply a change to a question's logic: `patch` merges into readLogic's shape. */
export function updateLogic(item, patch) {
  return writeLogic(item, { ...readLogic(item), ...patch });
}

/** Switch answer type. The old answers don't exist in the new type, so their rules go. */
export function setAnswerType(item, type) {
  if (type === answerTypeOf(item) && item.answerType) return item;
  return writeLogic(item, { type, good: null, threshold: '', unit: '', criteria: '', match: null, route: null });
}

/**
 * Bring stored conditions in line with the question as it now reads. Run on
 * every change (from normalizeItems): a yes/no branch names its question, so
 * rewording the question rewrites the condition; and branches loaded in a
 * form the engine can't act on (a condition-tab is_false, which it never
 * matches) are rewritten into one it can.
 */
export function syncLogic(item) {
  if (!isQuestion(item)) return item;
  const { type, source } = answerTypeInfo(item);
  if (source === 'guess' || type === 'open') return item;
  return writeLogic(item, readLogic(item));
}

// ── Describing ──────────────────────────────────────────────────────────────

/** The answers a fixed-answer question can get, labelled for display. */
export function answerChoices(logic) {
  if (logic.type === 'yesno') {
    return [
      { key: 'yes', label: 'Yes', icon: 'check' },
      { key: 'no', label: 'No', icon: 'close' },
    ];
  }
  if (logic.type === 'number') {
    const n = [clean(logic.threshold) || '…', clean(logic.unit)].filter(Boolean).join(' ');
    return [
      { key: 'above', label: `More than ${n}`, icon: 'arrow_upward' },
      { key: 'below', label: `Less than ${n}`, icon: 'arrow_downward' },
    ];
  }
  return [];
}

const short = (s, max = 42) => {
  const t = clean(s).replace(/[.。]$/, '');
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};
const matchLabel = (m) => {
  const label = MATCH_CONDITIONS.find(c => c.value === m.condition)?.label || m.condition;
  return YES_NO.includes(m.condition) ? label : `${label} “${short(m.value, 24)}”`;
};

/** "If no", "If more than 2 years", "If they ask to be called later". */
export function routeWhenLabel(logic) {
  const r = logic.route;
  if (!r) return '';
  if (logic.type === 'open') {
    if (r.condition) return `If the answer ${matchLabel(r.condition)}`;
    const t = short(r.text);
    return t ? `If ${/^(they|the|their|it)\b/i.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : `“${t}”`}` : 'If …';
  }
  const choice = answerChoices(logic).find(c => c.key === r.when);
  return `If ${choice ? choice.label.charAt(0).toLowerCase() + choice.label.slice(1) : '…'}`;
}

/** The good answer in a few words, or '' when any answer counts. */
export function goodAnswerLabel(logic) {
  if (logic.type === 'open') {
    if (clean(logic.criteria)) return short(logic.criteria, 48);
    return logic.match ? `Answer ${matchLabel(logic.match)}` : '';
  }
  const choice = answerChoices(logic).find(c => c.key === logic.good);
  return choice ? choice.label : '';
}

/**
 * What a question does beyond asking, as a handful of icon-led facts for the
 * folded view: where it can end or redirect the call, what scores, and so on.
 * `items` resolves jump targets to their position.
 */
export function describeLogic(item, items = []) {
  if (!isQuestion(item)) return [];
  const logic = readLogic(item);
  const facts = [];
  const r = logic.route;
  if (r?.action === 'end_call') {
    facts.push({ icon: 'call_end', tone: 'negative', text: `${routeWhenLabel(logic)} → ends the call` });
  }
  if (r?.action === 'skip_question') {
    const to = items.findIndex(i => i.id === r.skipToId);
    facts.push({ icon: 'redo', tone: 'brand', text: `${routeWhenLabel(logic)} → jumps to ${to >= 0 ? to + 1 : '…'}` });
  }
  const good = goodAnswerLabel(logic);
  if (good) facts.push({ icon: 'star', tone: 'caution', text: `Good answer: ${logic.type === 'open' ? good : good.charAt(0).toLowerCase() + good.slice(1)}` });
  if (item.is_mandatory) facts.push({ icon: 'replay', tone: 'neutral', text: 'Keeps asking' });
  const subs = item.fieldsToExtract?.length || 0;
  if (subs) facts.push({ icon: 'table_rows', tone: 'neutral', text: `Saves ${subs} detail${subs === 1 ? '' : 's'}` });
  return facts;
}

/** id → the 1-based positions of the questions that can jump to it. */
export function incomingJumps(items = []) {
  const map = {};
  items.forEach((item, idx) => {
    const target = item.onAnswer?.action === 'skip_question' && item.onAnswer.skipToId;
    if (target) (map[target] ||= []).push(idx + 1);
  });
  return map;
}
