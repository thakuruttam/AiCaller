import { describe, it, expect } from 'vitest';
import {
  parseNumeric,
  wasQuestionAsked,
  scoreExpectedAnswer,
  scoreQuestion,
  scoreAllQuestions,
} from '../../src/pipeline/scorer.js';

const turn = (role, text) => ({ role, text });

describe('parseNumeric', () => {
  it('parses a digit string', () => {
    expect(parseNumeric('20 years')).toBe(20);
  });

  it('parses a word-number string', () => {
    expect(parseNumeric('Five years')).toBe(5);
  });

  it('returns null for a non-numeric string', () => {
    expect(parseNumeric('abc')).toBeNull();
  });

  it('returns null for empty/null input', () => {
    expect(parseNumeric(null)).toBeNull();
    expect(parseNumeric('')).toBeNull();
  });
});

describe('wasQuestionAsked', () => {
  it('returns false when fewer than the required significant keywords match', () => {
    const turns = [turn('agent', 'what do you have')];
    expect(wasQuestionAsked(turns, 'What is your current occupation')).toBe(false);
  });

  it('returns true when 2+ significant keywords appear in an agent turn', () => {
    const turns = [turn('agent', 'can you tell me your current occupation please')];
    expect(wasQuestionAsked(turns, 'What is your current occupation')).toBe(true);
  });

  it('ignores user turns', () => {
    const turns = [turn('user', 'my current occupation is a teacher')];
    expect(wasQuestionAsked(turns, 'What is your current occupation')).toBe(false);
  });

  it('strips [placeholder] tokens before keyword matching', () => {
    const turns = [turn('agent', 'are you currently working as a software professional')];
    expect(wasQuestionAsked(turns, 'Are you currently working as a [role/domain] professional')).toBe(true);
  });

  it('returns false when turns is empty or undefined', () => {
    expect(wasQuestionAsked([], 'What is your current occupation')).toBe(false);
    expect(wasQuestionAsked(undefined, 'What is your current occupation')).toBe(false);
  });

  it('returns false when the question text has no significant keywords', () => {
    expect(wasQuestionAsked([turn('agent', 'ok yes no')], 'ok?')).toBe(false);
  });

  it('detects a question made entirely of short words (regression — was always false with the old length>5 cutoff)', () => {
    const turns = [turn('agent', 'What date would you be able to join us by?')];
    expect(wasQuestionAsked(turns, 'What date would you be able to join us by?')).toBe(true);
  });

  it('still rejects an unrelated short-worded agent turn', () => {
    const turns = [turn('agent', 'Thanks for your time today')];
    expect(wasQuestionAsked(turns, 'What date would you be able to join us by?')).toBe(false);
  });
});

describe('scoreExpectedAnswer', () => {
  it('returns unmet for an empty answer regardless of condition', () => {
    expect(scoreExpectedAnswer({ condition: 'is any value' }, '')).toEqual({ ratio: 0, met: false });
    expect(scoreExpectedAnswer({ condition: 'contains', value: 'x' }, '   ')).toEqual({ ratio: 0, met: false });
    expect(scoreExpectedAnswer({ condition: 'contains', value: 'x' }, null)).toEqual({ ratio: 0, met: false });
  });

  it("treats missing condition or 'is any value' as always met", () => {
    expect(scoreExpectedAnswer(undefined, 'anything')).toEqual({ ratio: 1, met: true });
    expect(scoreExpectedAnswer({ condition: 'is any value' }, 'anything')).toEqual({ ratio: 1, met: true });
  });

  it('delegates is_true / is_false to the shared affirmatives logic', () => {
    expect(scoreExpectedAnswer({ condition: 'is_true' }, 'yes')).toEqual({ ratio: 1, met: true });
    expect(scoreExpectedAnswer({ condition: 'is_true' }, 'no')).toEqual({ ratio: 0, met: false });
    expect(scoreExpectedAnswer({ condition: 'is_false' }, 'no')).toEqual({ ratio: 1, met: true });
    expect(scoreExpectedAnswer({ condition: 'is_false' }, 'yes')).toEqual({ ratio: 0, met: false });
  });

  it("'is greater than' meets when answer >= expected", () => {
    expect(scoreExpectedAnswer({ condition: 'is greater than', value: '20' }, '25')).toEqual({ ratio: 1, met: true });
  });

  it("'is greater than' gives partial credit when answer < expected", () => {
    const result = scoreExpectedAnswer({ condition: 'is greater than', value: '20' }, '10');
    expect(result.met).toBe(false);
    expect(result.ratio).toBeCloseTo(0.5);
  });

  it("'is less than' meets when answer <= expected", () => {
    expect(scoreExpectedAnswer({ condition: 'is less than', value: '20' }, '10')).toEqual({ ratio: 1, met: true });
  });

  it('uses days-normalized comparison when both sides carry a recognizable time unit', () => {
    // 3 months = 90 days, 60 days -> 90 >= 60, met
    expect(scoreExpectedAnswer({ condition: 'is greater than', value: '60 days' }, '3 months')).toEqual({ ratio: 1, met: true });
  });

  it("'contains' matches a substring case-insensitively", () => {
    expect(scoreExpectedAnswer({ condition: 'contains', value: 'python' }, 'I know Python well')).toEqual({ ratio: 1, met: true });
    expect(scoreExpectedAnswer({ condition: 'contains', value: 'python' }, 'I know Java')).toEqual({ ratio: 0, met: false });
  });

  it("'contains' with an empty value is never a pass", () => {
    expect(scoreExpectedAnswer({ condition: 'contains', value: '' }, 'anything')).toEqual({ ratio: 0, met: false });
  });

  it("'does not contain' / 'equals' / 'starts with' / 'ends with'", () => {
    expect(scoreExpectedAnswer({ condition: 'does not contain', value: 'python' }, 'I know Java')).toEqual({ ratio: 1, met: true });
    expect(scoreExpectedAnswer({ condition: 'does not contain', value: 'python' }, 'I know Python')).toEqual({ ratio: 0, met: false });
    expect(scoreExpectedAnswer({ condition: 'equals', value: 'yes' }, 'Yes')).toEqual({ ratio: 1, met: true });
    expect(scoreExpectedAnswer({ condition: 'equals', value: 'yes' }, 'yes please')).toEqual({ ratio: 0, met: false });
    expect(scoreExpectedAnswer({ condition: 'starts with', value: 'hello' }, 'Hello there')).toEqual({ ratio: 1, met: true });
    expect(scoreExpectedAnswer({ condition: 'ends with', value: 'bye' }, 'good bye')).toEqual({ ratio: 1, met: true });
  });
});

describe('scoreQuestion', () => {
  it('short-circuits to a skipped breakdown row when the question was not asked', () => {
    const question = { id: 'q1', text: 'Occupation?', weight: 10 };
    const result = scoreQuestion(question, {}, { wasAsked: false });
    expect(result.skipped).toBe(true);
    expect(result.wasAsked).toBe(false);
    expect(result.questionScore).toBe(0);
    expect(result.breakdownRows[0].reason).toBe('skipped');
    expect(result.breakdownRows[0].awarded).toBe(0);
  });

  it('produces a no_answer row when asked but no answer was extracted', () => {
    const question = { id: 'q1', text: 'Occupation?', weight: 10, expectedAnswer: { condition: 'is any value' } };
    const result = scoreQuestion(question, {}, { wasAsked: true });
    expect(result.questionScore).toBe(0);
    expect(result.breakdownRows[0].reason).toBe('no_answer');
  });

  it('awards full weight for a met simple question', () => {
    const question = { id: 'q1', text: 'Occupation?', weight: 10, expectedAnswer: { condition: 'is any value' } };
    const result = scoreQuestion(question, { answerExtracted: 'Engineer' }, { wasAsked: true });
    expect(result.questionScore).toBe(10);
    expect(result.breakdownRows[0].reason).toBe('met');
  });

  it('scores sub-fields independently and only counts main question weight when it has real logic', () => {
    const question = {
      id: 'q1',
      text: 'Contact details',
      weight: 5,
      fieldsToExtract: [
        { field: 'phone', weight: 3 },
        { field: 'email', weight: 3 },
      ],
      expectedAnswer: { condition: 'is any value' }, // no real logic when sub-fields exist
    };
    const llmResult = {
      subFieldsExtracted: { phone: { value: '12345' }, email: { value: null } },
    };
    const result = scoreQuestion(question, llmResult, { wasAsked: true });
    // phone present (3), email missing (0), main question weight not counted ('is any value' with sub-fields present = no real logic)
    expect(result.questionScore).toBe(3);
    expect(result.breakdownRows).toHaveLength(2);
  });

  it('uses the LLM scoreRatio for a "contains" condition', () => {
    const question = { id: 'q1', text: 'Skills?', weight: 10, expectedAnswer: { condition: 'contains', value: 'node' } };
    const result = scoreQuestion(question, { answerExtracted: 'JavaScript expert', scoreRatio: 0.8 }, { wasAsked: true });
    expect(result.questionScore).toBe(8);
  });

  it('ignores the LLM scoreRatio for a numeric condition and uses deterministic scoring instead', () => {
    const question = { id: 'q1', text: 'Experience?', weight: 10, expectedAnswer: { condition: 'is greater than', value: '5' } };
    // LLM says 0.9 but the deterministic numeric check should be used instead (3 < 5 -> partial ratio 3/5=0.6)
    const result = scoreQuestion(question, { answerExtracted: '3', scoreRatio: 0.9 }, { wasAsked: true });
    expect(result.questionScore).toBeCloseTo(6);
  });
});

describe('scoreAllQuestions', () => {
  it('filters dataToCollect to itemType === "question" only', () => {
    const dataToCollect = [
      { itemType: 'info', id: 'i1', text: 'Just info' },
      { itemType: 'question', id: 'q1', text: 'Occupation is your current job', weight: 10, expectedAnswer: { condition: 'is any value' } },
    ];
    const turns = [turn('agent', 'what is your current job occupation')];
    const result = scoreAllQuestions(dataToCollect, [{ questionId: 'q1', answerExtracted: 'Engineer' }], turns);
    expect(result.questionResults).toHaveLength(1);
    expect(result.questionResults[0].questionId).toBe('q1');
  });

  it('returns score 0 and empty breakdown for empty dataToCollect', () => {
    const result = scoreAllQuestions([], [], []);
    expect(result.score).toBe(0);
    expect(result.breakdown).toEqual([]);
  });

  it('clamps the final score to [0, 100]', () => {
    const dataToCollect = [
      { itemType: 'question', id: 'q1', text: 'Occupation is your current job', weight: 60, expectedAnswer: { condition: 'is any value' } },
      { itemType: 'question', id: 'q2', text: 'Salary is your monthly income', weight: 60, expectedAnswer: { condition: 'is any value' } },
    ];
    const turns = [
      turn('agent', 'what is your current job occupation'),
      turn('agent', 'what is your monthly salary income'),
    ];
    const llmResults = [
      { questionId: 'q1', answerExtracted: 'Engineer' },
      { questionId: 'q2', answerExtracted: '5000' },
    ];
    const result = scoreAllQuestions(dataToCollect, llmResults, turns);
    expect(result.score).toBe(100);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
