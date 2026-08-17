import { describe, it, expect } from 'vitest';
import { checkCompliance } from '../../src/pipeline/complianceChecker.js';

const turn = (role, text) => ({ role, text });

describe('checkCompliance', () => {
  it('detects identity verification phrases', () => {
    const turns = [turn('agent', 'Hi, am I speaking with John?'), turn('user', 'yes')];
    expect(checkCompliance(turns, []).identityVerified).toBe(true);
  });

  it('reports identity not verified when no matching phrase is present', () => {
    const turns = [turn('agent', 'Hello there'), turn('user', 'hi')];
    expect(checkCompliance(turns, []).identityVerified).toBe(false);
  });

  it('detects closure phrases', () => {
    const turns = [turn('agent', 'Thank you for your time, have a great day')];
    expect(checkCompliance(turns, []).closureDelivered).toBe(true);
  });

  it('reports closure not delivered when no sign-off phrase is present', () => {
    const turns = [turn('agent', 'ok bye')];
    expect(checkCompliance(turns, []).closureDelivered).toBe(false);
  });

  it('defaults questionCoverage to 1.0 when dataToCollect has no questions', () => {
    const result = checkCompliance([turn('agent', 'hello')], []);
    expect(result.questionCoverage).toBe(1);
    expect(result.questionsAsked).toEqual([]);
    expect(result.questionsSkipped).toEqual([]);
  });

  it('computes questionCoverage as 1 when all questions were asked', () => {
    const dataToCollect = [
      { itemType: 'question', text: 'What is your current occupation' },
    ];
    const turns = [turn('agent', 'Can you tell me your current occupation please')];
    const result = checkCompliance(turns, dataToCollect);
    expect(result.questionCoverage).toBe(1);
    expect(result.questionsAsked).toEqual(['What is your current occupation']);
    expect(result.questionsSkipped).toEqual([]);
  });

  it('computes questionCoverage as 0 when no questions were asked', () => {
    const dataToCollect = [
      { itemType: 'question', text: 'What is your current occupation' },
    ];
    const turns = [turn('agent', 'Hello, how are you today')];
    const result = checkCompliance(turns, dataToCollect);
    expect(result.questionCoverage).toBe(0);
    expect(result.questionsSkipped).toEqual(['What is your current occupation']);
  });

  it('computes a partial questionCoverage ratio', () => {
    const dataToCollect = [
      { itemType: 'question', text: 'What is your current occupation' },
      { itemType: 'question', text: 'What is your monthly income amount' },
    ];
    const turns = [turn('agent', 'Can you tell me your current occupation please')];
    const result = checkCompliance(turns, dataToCollect);
    expect(result.questionCoverage).toBe(0.5);
    expect(result.questionsAsked).toEqual(['What is your current occupation']);
    expect(result.questionsSkipped).toEqual(['What is your monthly income amount']);
  });

  it('ignores non-question items in dataToCollect', () => {
    const dataToCollect = [{ itemType: 'info', text: 'Some info item' }];
    const result = checkCompliance([turn('agent', 'hello')], dataToCollect);
    expect(result.questionCoverage).toBe(1); // zero real questions -> default 1.0
  });

  it('counts interruptionsHandled as user turns of <=3 words', () => {
    const turns = [
      turn('user', 'ok'),
      turn('user', 'yes I am'),
      turn('user', 'I think that is a longer answer'),
    ];
    expect(checkCompliance(turns, []).interruptionsHandled).toBe(2);
  });

  it('computes scriptAdherenceScore with the 20/20/60 weighting', () => {
    const turns = [turn('agent', 'am i speaking with the right person'), turn('agent', 'thank you for your time, goodbye')];
    // identityVerified true (+20), closureDelivered true (+20), no questions -> coverage 1 (+60)
    expect(checkCompliance(turns, []).scriptAdherenceScore).toBe(100);
  });

  it('caps scriptAdherenceScore at 100', () => {
    const turns = [turn('agent', 'am i speaking with you, thank you for your time, have a great day')];
    const result = checkCompliance(turns, []);
    expect(result.scriptAdherenceScore).toBeLessThanOrEqual(100);
  });

  it('scores 0 when nothing was verified/delivered/covered', () => {
    const dataToCollect = [{ itemType: 'question', text: 'What is your current occupation' }];
    const turns = [turn('agent', 'Hello there')];
    expect(checkCompliance(turns, dataToCollect).scriptAdherenceScore).toBe(0);
  });

  it('strips template placeholders like [role/domain] before keyword matching', () => {
    const dataToCollect = [
      { itemType: 'question', text: 'Are you currently working as a [role/domain] professional' },
    ];
    // agent asks the question with the placeholder replaced by a real value at runtime
    const turns = [turn('agent', 'Are you currently working as a software professional')];
    const result = checkCompliance(turns, dataToCollect);
    expect(result.questionsAsked).toEqual(['Are you currently working as a [role/domain] professional']);
  });
});
