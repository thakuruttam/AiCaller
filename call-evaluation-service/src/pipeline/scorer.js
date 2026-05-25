// src/pipeline/scorer.js — Deterministic weighted scoring from campaign dataToCollect
import { isAffirmative, isNegative } from './affirmatives.js';

/**
 * Parse the first number from a string (e.g. "20 years" → 20).
 */
export function parseNumeric(value) {
  if (value == null || value === '') return null;
  const match = String(value).match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
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
    if (numAnswer >= numExpected) return { ratio: 1, met: true };
    return { ratio: Math.max(0, Math.min(1, numAnswer / numExpected)), met: false };
  }

  if (condition === 'is less than' && numExpected != null) {
    if (numAnswer == null) return { ratio: 0, met: false };
    if (numAnswer <= numExpected) return { ratio: 1, met: true };
    if (numAnswer <= 0) return { ratio: 0, met: false };
    return { ratio: Math.max(0, Math.min(1, numExpected / numAnswer)), met: false };
  }

  if (condition === 'contains') {
    const met = expectedLower ? answerLower.includes(expectedLower) : true;
    return { ratio: met ? 1 : 0, met };
  }
  if (condition === 'does not contain') {
    const met = expectedLower ? !answerLower.includes(expectedLower) : true;
    return { ratio: met ? 1 : 0, met };
  }
  if (condition === 'equals') {
    const met = answerLower === expectedLower;
    return { ratio: met ? 1 : 0, met };
  }
  if (condition === 'starts with') {
    const met = expectedLower ? answerLower.startsWith(expectedLower) : true;
    return { ratio: met ? 1 : 0, met };
  }
  if (condition === 'ends with') {
    const met = expectedLower ? answerLower.endsWith(expectedLower) : true;
    return { ratio: met ? 1 : 0, met };
  }

  return { ratio: 0, met: false };
}

function getQuestionTotalWeight(question) {
  const subFields = question.fieldsToExtract || [];
  if (subFields.length > 0) {
    return subFields.reduce((s, sf) => s + (sf.weight || 0), 0) + (question.weight || 0);
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

    if ((question.weight || 0) > 0) {
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
