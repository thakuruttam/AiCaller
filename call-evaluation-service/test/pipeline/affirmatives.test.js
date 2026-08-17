import { describe, it, expect } from 'vitest';
import { isAffirmative, isNegative, isTrivialTurn } from '../../src/pipeline/affirmatives.js';

describe('isAffirmative', () => {
  it('recognizes a single affirmative word', () => {
    expect(isAffirmative('yes')).toBe(true);
    expect(isAffirmative('Yeah')).toBe(true);
  });

  it('recognizes a multi-word affirmative phrase', () => {
    expect(isAffirmative("that's me")).toBe(true);
    expect(isAffirmative('yes speaking')).toBe(true);
  });

  it('returns false when mixed with a non-affirmative word', () => {
    // every word must be affirmative for the word-list path, and no full phrase matches
    expect(isAffirmative('yes but no')).toBe(false);
  });

  it('returns false for empty/null input', () => {
    expect(isAffirmative('')).toBe(false);
    expect(isAffirmative(null)).toBe(false);
    expect(isAffirmative(undefined)).toBe(false);
  });

  it('is case-insensitive and tolerates punctuation', () => {
    expect(isAffirmative('YES!')).toBe(true);
    expect(isAffirmative("Sure, of course.")).toBe(true);
  });
});

describe('isNegative', () => {
  it('matches an exact negative word', () => {
    expect(isNegative('no')).toBe(true);
    expect(isNegative('nope')).toBe(true);
  });

  it('matches a negative word inside a short phrase (<=4 words)', () => {
    expect(isNegative('no not at all')).toBe(true);
  });

  it('does not match a negative word inside a long phrase (>4 words)', () => {
    expect(isNegative('well I am not sure about that actually no')).toBe(false);
  });

  it('returns false for empty/null input', () => {
    expect(isNegative('')).toBe(false);
    expect(isNegative(null)).toBe(false);
  });

  it('returns false for an affirmative phrase', () => {
    expect(isNegative('yes definitely')).toBe(false);
  });
});

describe('isTrivialTurn', () => {
  it('treats empty/null input as trivial', () => {
    expect(isTrivialTurn('')).toBe(true);
    expect(isTrivialTurn(null)).toBe(true);
  });

  it('treats an exact affirmative phrase as trivial', () => {
    expect(isTrivialTurn("that's me")).toBe(true);
  });

  it('treats a turn of exactly 5 trivial words as trivial (boundary)', () => {
    expect(isTrivialTurn('hi yes ok thanks bye')).toBe(true);
  });

  it('treats a turn of 6 trivial words as NOT trivial (boundary)', () => {
    expect(isTrivialTurn('hi yes ok thanks bye goodbye')).toBe(false);
  });

  it('treats a substantive answer as not trivial', () => {
    expect(isTrivialTurn("I've been in sales for five years")).toBe(false);
  });
});
