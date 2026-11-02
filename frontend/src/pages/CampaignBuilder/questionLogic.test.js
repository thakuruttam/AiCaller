import { describe, it, expect } from 'vitest';
import { newItem, normalizeItems } from './campaignModel';
import {
  answerTypeInfo, describeLogic, guessAnswerType, incomingJumps, readLogic, setAnswerType,
  updateLogic,
} from './questionLogic';

const question = (text, extra = {}) => ({ ...newItem('question', text), ...extra });

describe('answer types', () => {
  it.each([
    ['Are you still interested in the role?', 'yesno'],
    ['Do you have a two-wheeler?', 'yesno'],
    ['Kya aap abhi baat kar sakte hain?', 'yesno'],
    ['How many years of experience do you have?', 'number'],
    ['What is your notice period?', 'number'],
    ['What is your expected CTC?', 'number'],
    ['What kind of role are you looking for?', 'open'],
  ])('guesses %j as %s', (text, type) => {
    expect(guessAnswerType(text)).toBe(type);
  });

  it('follows the words until the question has rules, then keeps its type', () => {
    expect(answerTypeInfo(question('Are you free?'))).toEqual({ type: 'yesno', source: 'guess' });
    const ruled = updateLogic(question('Are you free?'), { good: 'yes' });
    expect(answerTypeInfo({ ...ruled, text: 'What is your name?' })).toEqual({ type: 'yesno', source: 'set' });
  });

  it('reads the type of older questions from the rules they carry', () => {
    const legacyYesNo = question('Interested?', { expectedAnswer: { condition: 'equals', value: 'Yes' } });
    expect(answerTypeInfo(legacyYesNo)).toEqual({ type: 'yesno', source: 'logic' });
    const legacyNumber = question('Experience?', { expectedAnswer: { condition: 'is greater than', value: '2 years' } });
    expect(readLogic(legacyNumber)).toMatchObject({ type: 'number', good: 'above', threshold: '2', unit: 'years' });
    // A yes/no score with a free-text branch can only be shown as free-form.
    const mixed = question('Interested?', {
      expectedAnswer: { condition: 'equals', value: 'yes' },
      onAnswer: { ...newItem().onAnswer, action: 'end_call', skipConditionActiveTab: 'semantic', skipSemanticCondition: 'They are busy' },
    });
    expect(readLogic(mixed)).toMatchObject({
      type: 'open',
      match: { condition: 'equals', value: 'yes' },
      route: { action: 'end_call', text: 'They are busy' },
    });
  });

  it('drops the old rules when the type changes', () => {
    const ruled = updateLogic(question('Are you free?'), { good: 'yes', route: { when: 'no', action: 'end_call' } });
    const open = setAnswerType(ruled, 'open');
    expect(readLogic(open)).toMatchObject({ type: 'open', good: null, route: null, criteria: '' });
    expect(open.onAnswer.action).toBe('continue');
  });
});

describe('yes/no questions', () => {
  it('scores with the boolean rules the evaluator understands', () => {
    const item = updateLogic(question('Are you free?'), { good: 'no' });
    expect(item.expectedAnswer).toEqual({ condition: 'is_false', value: '' });
    expect(item.scoringActiveTab).toBe('condition');
  });

  it('branches on a semantic condition that names the question, since the engine cannot match is_true/is_false', () => {
    const item = updateLogic(question('Are you free?'), { route: { when: 'no', action: 'end_call' } });
    expect(item.onAnswer).toMatchObject({
      action: 'end_call',
      when: 'no',
      skipConditionActiveTab: 'semantic',
      skipSemanticCondition: 'Their answer to “Are you free?” means no',
    });
    expect(readLogic(item).route).toMatchObject({ when: 'no', action: 'end_call' });
  });

  it('rewrites the condition when the question is reworded', () => {
    const item = updateLogic(question('Are you free?'), { route: { when: 'no', action: 'end_call' } });
    const [reworded] = normalizeItems([{ ...item, text: 'Is now a good time?' }]);
    expect(reworded.onAnswer.skipSemanticCondition).toBe('Their answer to “Is now a good time?” means no');
  });

  it('repairs a branch saved in a form the engine never fires', () => {
    const legacy = question('Are you free?', {
      onAnswer: { ...newItem().onAnswer, action: 'end_call', skipConditionActiveTab: 'condition', skipCondition: { condition: 'is_false', value: '' } },
    });
    const [fixed] = normalizeItems([legacy]);
    expect(fixed.onAnswer).toMatchObject({ skipConditionActiveTab: 'semantic', when: 'no' });
    expect(fixed.onAnswer.skipSemanticCondition).toMatch(/means no$/);
  });

  it('keeps one rule per question — giving "yes" a rule takes it off "no"', () => {
    const [a, b] = normalizeItems([question('Are you free?'), question('Later?')]);
    const noEnds = updateLogic(a, { route: { when: 'no', action: 'end_call' } });
    const yesJumps = updateLogic(noEnds, { route: { when: 'yes', action: 'skip_question', skipToId: b.id } });
    expect(readLogic(yesJumps).route).toMatchObject({ when: 'yes', action: 'skip_question', skipToId: b.id });
  });
});

describe('number questions', () => {
  it('compares against the threshold and unit in both scoring and branching', () => {
    const item = updateLogic(question('How many years of experience?'), {
      threshold: '2', unit: 'years', good: 'above', route: { when: 'below', action: 'end_call' },
    });
    expect(item.expectedAnswer).toEqual({ condition: 'is greater than', value: '2 years' });
    expect(item.onAnswer).toMatchObject({
      action: 'end_call',
      skipConditionActiveTab: 'condition',
      skipCondition: { condition: 'is less than', value: '2 years' },
    });
  });

  it('remembers a threshold before any rule uses it', () => {
    const item = updateLogic(question('Your age?'), { type: 'number', threshold: '18' });
    expect(readLogic(item)).toMatchObject({ type: 'number', threshold: '18', good: null, route: null });
    expect(item.expectedAnswer.condition).toBe('is any value');
  });
});

describe('free-form questions', () => {
  it('lets the AI judge a described good answer, and any answer count once cleared', () => {
    const judged = updateLogic(question('Why this role?'), { criteria: 'Mentions the product' });
    expect(judged).toMatchObject({ scoringActiveTab: 'semantic', scoringCriteria: 'Mentions the product' });
    const cleared = updateLogic(judged, { criteria: '' });
    expect(cleared).toMatchObject({ scoringActiveTab: 'condition', expectedAnswer: { condition: 'is any value' } });
  });

  it('describes its rule in words', () => {
    const item = updateLogic(question('Why this role?'), {
      route: { when: 'custom', action: 'end_call', text: 'They say they are not interested', condition: null },
    });
    expect(item.onAnswer).toMatchObject({ action: 'end_call', skipConditionActiveTab: 'semantic', skipSemanticCondition: 'They say they are not interested' });
  });
});

describe('describing a line', () => {
  it('lists where it ends or redirects the call and what scores', () => {
    const items = normalizeItems([question('Are you free?'), question('Second?'), question('Third?')]);
    items[0] = updateLogic({ ...items[0], is_mandatory: true }, {
      good: 'yes', route: { when: 'no', action: 'skip_question', skipToId: items[2].id },
    });
    expect(describeLogic(items[0], items).map(f => f.text)).toEqual([
      'If no → jumps to 3',
      'Good answer: yes',
      'Keeps asking',
    ]);
    expect(incomingJumps(items)).toEqual({ [items[2].id]: [1] });
  });

  it('says nothing about a plain question', () => {
    expect(describeLogic(question('What is your name?'))).toEqual([]);
  });
});
