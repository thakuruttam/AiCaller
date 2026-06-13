// src/pipeline/scorer.js — Deterministic weighted scoring from campaign dataToCollect
import { isAffirmative, isNegative } from './affirmatives.js';

import { wordsToNumbers } from 'words-to-numbers';

/**
 * Parse the first number from a string (e.g. "20 years" or "Five years" → 20/5).
 */
export function parseNumeric(value) {
  if (value == null || value === '') return null;
  const asNumber = wordsToNumbers(String(value).toLowerCase());
  const match = String(asNumber).match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

// Multipliers to convert common time units → days
const DAY_MULT = { day: 1, days: 1, week: 7, weeks: 7, month: 30, months: 30, year: 365, years: 365 };

/**
 * Convert a temporal string to days (e.g. "3 months" → 90, "2 weeks" → 14).
 * Returns null if no recognisable time unit is found.
 */
function toDays(str) {
  if (!str) return null;
  const s = String(wordsToNumbers(String(str).toLowerCase()));
  for (const [unit, mult] of Object.entries(DAY_MULT)) {
    const m = s.match(new RegExp(`(-?\\d+(?:\\.\\d+)?)\\s*${unit}\\b`));
    if (m) return parseFloat(m[1]) * mult;
  }
  return null;
}

/**
 * Detect whether the agent asked a question on the call.
 * Uses significant-word overlap: requires at least 2 distinct keywords (length > 5)
 * to appear in the same agent turn, preventing false positives from short common
 * words like "your", "have", "what" that appear across multiple questions.
 */
export function wasQuestionAsked(turns, questionText) {
  const agentTurns = (turns || [])
    .filter(t => t.role === 'agent')
    .map(t => t.text.toLowerCase());
  // Strip template placeholders like [role/domain] before keyword extraction —
  // the agent replaces them with real values, so the literal placeholder text
  // would never match the agent's speech.
  const qText = (questionText || '').toLowerCase().replace(/\[[^\]]*\]/g, '');
  const qWords = qText
    .split(/\s+/)
    .map(w => w.replace(/[^\w]/g, ''))
    .filter(w => w.length > 5);
  if (!qWords.length) return false;

  const needed = Math.min(2, qWords.length);
  return agentTurns.some(agentText =>
    qWords.filter(w => agentText.includes(w)).length >= needed
  );
}

function formatExpectedRule(expectedAnswer) {
  if (!expectedAnswer?.condition || expectedAnswer.condition === 'is any value') {
    return 'Any answer';
  }
  const { condition, value } = expectedAnswer;
  const labels = {
    contains: 'Contains',
    'does not contain': 'Does not contain',
    equals: 'Equals',
    'starts with': 'Starts with',
    'ends with': 'Ends with',
    'is greater than': 'Greater than',
    'is less than': 'Less than',
    is_true: 'Answer is YES',
    is_false: 'Answer is NO',
  };
  const label = labels[condition] || condition;
  if (condition === 'is_true' || condition === 'is_false') return label;
  return value ? `${label}: ${value}` : label;
}

/**
 * Score how well an answer meets the expected-answer rule.
 * @returns {{ ratio: number, met: boolean }} ratio 0–1
 */
export function scoreExpectedAnswer(expectedAnswer, answerExtracted) {
  if (answerExtracted == null || String(answerExtracted).trim() === '') {
    return { ratio: 0, met: false };
  }

  const { condition, value } = expectedAnswer || { condition: 'is any value', value: '' };
  const answer = String(answerExtracted).trim();
  const answerLower = answer.toLowerCase();
  const expectedLower = (value || '').trim().toLowerCase();

  if (!condition || condition === 'is any value') {
    return { ratio: 1, met: true };
  }

  // Boolean — use shared affirmatives list so "speaking", "hmm", "this is me" etc. all work
  if (condition === 'is_true') {
    const met = isAffirmative(answer);
    return { ratio: met ? 1 : 0, met };
  }
  if (condition === 'is_false') {
    const met = isNegative(answer);
    return { ratio: met ? 1 : 0, met };
  }

  const numAnswer = parseNumeric(answer);
  const numExpected = parseNumeric(value);

  if (condition === 'is greater than' && numExpected != null) {
    if (numAnswer == null) return { ratio: 0, met: false };
    // Use days-normalised comparison when both sides carry a time unit
    const dA = toDays(answer), dE = toDays(value);
    const a = (dA != null && dE != null) ? dA : numAnswer;
    const e = (dA != null && dE != null) ? dE : numExpected;
    if (a >= e) return { ratio: 1, met: true };
    return { ratio: Math.max(0, Math.min(1, a / e)), met: false };
  }

  if (condition === 'is less than' && numExpected != null) {
    if (numAnswer == null) return { ratio: 0, met: false };
    // Use days-normalised comparison when both sides carry a time unit
    const dA = toDays(answer), dE = toDays(value);
    const a = (dA != null && dE != null) ? dA : numAnswer;
    const e = (dA != null && dE != null) ? dE : numExpected;
    if (a <= e) return { ratio: 1, met: true };
    if (a <= 0) return { ratio: 0, met: false };
    return { ratio: Math.max(0, Math.min(1, e / a)), met: false };
  }

  if (condition === 'contains') {
    // No value → no meaningful rule → 0, not auto-pass
    if (!expectedLower) return { ratio: 0, met: false };
    const met = answerLower.includes(expectedLower);
    return { ratio: met ? 1 : 0, met };
  }
  if (condition === 'does not contain') {
    if (!expectedLower) return { ratio: 0, met: false };
    const met = !answerLower.includes(expectedLower);
    return { ratio: met ? 1 : 0, met };
  }
  if (condition === 'equals') {
    if (!expectedLower) return { ratio: 0, met: false };
    const met = answerLower === expectedLower;
    return { ratio: met ? 1 : 0, met };
  }
  if (condition === 'starts with') {
    if (!expectedLower) return { ratio: 0, met: false };
    const met = answerLower.startsWith(expectedLower);
    return { ratio: met ? 1 : 0, met };
  }
  if (condition === 'ends with') {
    if (!expectedLower) return { ratio: 0, met: false };
    const met = answerLower.endsWith(expectedLower);
    return { ratio: met ? 1 : 0, met };
  }

  return { ratio: 0, met: false };
}

/**
 * Returns true only when the expectedAnswer represents a REAL, evaluable rule.
 * A condition with no value (e.g. "contains" with empty value) is NOT a real rule.
 * 'is any value' is also not a real rule when sub-fields exist — caller decides.
 */
function hasMainQuestionLogic(expectedAnswer, { requireValue = false } = {}) {
  if (!expectedAnswer) return false;
  const { condition, value } = expectedAnswer;
  if (!condition) return false;
  // is_true / is_false are self-contained boolean rules — always meaningful
  if (condition === 'is_true' || condition === 'is_false') return true;
  // 'is any value' is only meaningful when there are no sub-fields
  if (condition === 'is any value') return !requireValue;
  // All other conditions (contains, equals, starts with, etc.) require a non-empty value
  if (value && String(value).trim() !== '') return true;
  return false;
}

function getQuestionTotalWeight(question) {
  const subFields = question.fieldsToExtract || [];
  if (subFields.length > 0) {
    const subWeight = subFields.reduce((s, sf) => s + (sf.weight || 0), 0);
    // When sub-fields exist, expected answer weight only counts if it has REAL logic
    // (a non-empty value, or is a boolean rule). 'contains' with no value = no weight.
    const hasRealLogic = hasMainQuestionLogic(question.expectedAnswer, { requireValue: true });
    const mainWeight = hasRealLogic ? (question.weight || 0) : 0;
    return subWeight + mainWeight;
  }
  return question.weight || 0;
}

/**
 * Score one question (and its sub-fields) into breakdown rows.
 */
export function scoreQuestion(question, llmResult, { wasAsked }) {
  const breakdownRows = [];
  let totalPoints = 0;
  const maxWeight = getQuestionTotalWeight(question);

  if (!wasAsked) {
    return {
      questionId: question.id,
      questionText: question.text,
      wasAsked: false,
      skipped: true,
      questionScore: 0,
      breakdownRows: [{
        rule: 'Question not asked',
        field: question.text,
        fieldValue: 'Skipped on call',
        weight: maxWeight,
        awarded: 0,
        maxPoints: maxWeight,
        reason: 'skipped',
      }],
    };
  }

  const subFields = question.fieldsToExtract || [];
  const hasSubFields = subFields.length > 0;

  // Use LLM-provided scoreRatio for semantic evaluation; fall back to literal match.
  const llmRatio = (llmResult?.scoreRatio != null)
    ? Math.max(0, Math.min(1, Number(llmResult.scoreRatio)))
    : null;

  const getExpectedRatio = (answer) => {
    const condition = question.expectedAnswer?.condition;
    // Use LLM semantic ratio only for 'contains' / open-ended 'is any value' —
    // semantic understanding helps (e.g. "Node" ≡ "Node.js").
    // For logical/negation/numeric conditions, LLM can override correct deterministic
    // results (e.g. marking "does not contain: salary" as 0 for an incomplete answer),
    // so always use deterministic scoring for those.
    const semanticConditions = new Set([undefined, null, 'is any value', 'contains']);
    if (llmRatio !== null && semanticConditions.has(condition)) return llmRatio;
    return scoreExpectedAnswer(question.expectedAnswer, answer).ratio;
  };

  if (hasSubFields) {
    for (const sf of subFields) {
      const weight = sf.weight || 0;
      const extracted = llmResult?.subFieldsExtracted?.[sf.field];
      const present = extracted?.value != null && String(extracted.value).trim() !== '';
      const ratio = present ? 1 : 0;
      const awarded = parseFloat((weight * ratio).toFixed(2));
      totalPoints += awarded;
      breakdownRows.push({
        rule: 'Field present',
        field: sf.field,
        fieldValue: present ? String(extracted.value) : 'Missing',
        weight,
        awarded,
        maxPoints: weight,
        reason: present ? 'present' : 'missing',
      });
    }

    // Only score expected answer when it has REAL logic (non-empty value or boolean)
    if ((question.weight || 0) > 0 && hasMainQuestionLogic(question.expectedAnswer, { requireValue: true })) {
      const ratio = getExpectedRatio(llmResult?.answerExtracted);
      const weight = question.weight;
      const awarded = parseFloat((weight * ratio).toFixed(2));
      totalPoints += awarded;
      breakdownRows.push({
        rule: formatExpectedRule(question.expectedAnswer),
        field: question.text,
        fieldValue: llmResult?.answerExtracted ?? 'No answer',
        weight,
        awarded,
        maxPoints: weight,
        reason: ratio >= 1 ? 'met' : ratio > 0 ? 'partial' : 'not_met',
      });
    }
  } else {
    const weight = question.weight || 0;
    const answer = llmResult?.answerExtracted;
    const noAnswer = answer == null || String(answer).trim() === '';

    if (noAnswer) {
      breakdownRows.push({
        rule: formatExpectedRule(question.expectedAnswer),
        field: question.text,
        fieldValue: 'No answer',
        weight,
        awarded: 0,
        maxPoints: weight,
        reason: 'no_answer',
      });
    } else {
      const ratio = getExpectedRatio(answer);
      const awarded = parseFloat((weight * ratio).toFixed(2));
      totalPoints += awarded;
      breakdownRows.push({
        rule: formatExpectedRule(question.expectedAnswer),
        field: question.text,
        fieldValue: String(answer),
        weight,
        awarded,
        maxPoints: weight,
        reason: ratio >= 1 ? 'met' : ratio > 0 ? 'partial' : 'not_met',
      });
    }
  }

  return {
    questionId: question.id,
    questionText: question.text,
    wasAsked: true,
    skipped: false,
    questionScore: parseFloat(totalPoints.toFixed(2)),
    breakdownRows,
    answerExtracted: llmResult?.answerExtracted ?? null,
  };
}

/**
 * Score all questions for a call. Returns questionResults + flat breakdown for UI.
 */
export function scoreAllQuestions(dataToCollect, llmQuestionResults, turns) {
  const questions = (dataToCollect || []).filter(q => q.itemType === 'question');
  const results = [];
  const breakdown = [];

  for (const q of questions) {
    const llm = (llmQuestionResults || []).find(r => r.questionId === q.id) || {};
    const wasAsked = wasQuestionAsked(turns, q.text);
    const scored = scoreQuestion(q, llm, { wasAsked });

    results.push({
      questionId: q.id,
      questionText: q.text,
      answerExtracted: llm.answerExtracted ?? null,
      subFieldsExtracted: llm.subFieldsExtracted ?? {},
      wasAsked: scored.wasAsked,
      skipped: scored.skipped,
      questionScore: scored.questionScore,
      weight: getQuestionTotalWeight(q),
      breakdownRows: scored.breakdownRows,
    });
    breakdown.push(...scored.breakdownRows);
  }

  const total = results.reduce((s, r) => s + (r.questionScore || 0), 0);

  return {
    questionResults: results,
    score: Math.round(Math.min(100, Math.max(0, total))),
    breakdown,
  };
}
