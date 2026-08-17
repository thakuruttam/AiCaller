import { describe, it, expect } from 'vitest';
import { normalize } from '../../src/pipeline/normalizer.js';

describe('normalize', () => {
  it('returns empty turns and null callSid for null/empty input', () => {
    expect(normalize(null)).toEqual({ callSid: null, turns: [] });
    expect(normalize('')).toEqual({ callSid: null, turns: [] });
  });

  it('extracts and strips the Twilio SID header', () => {
    const raw = '[Twilio_SID:CA1234567890]\nUSER: hello\nA: hi there';
    const { callSid, turns } = normalize(raw);
    expect(callSid).toBe('CA1234567890');
    expect(turns).toEqual([
      { role: 'user', text: 'hello' },
      { role: 'agent', text: 'hi there' },
    ]);
  });

  it('has a null callSid when no header is present', () => {
    expect(normalize('USER: hi\nA: hello').callSid).toBeNull();
  });

  it('strips a single-line (System: ...) directive', () => {
    const raw = 'USER: hi\n(System: end call now)\nA: goodbye';
    const { turns } = normalize(raw);
    expect(turns).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'agent', text: 'goodbye' },
    ]);
  });

  it('strips a multi-line (System: ...) directive', () => {
    const raw = 'USER: hi\n(System: this is a\nmulti-line directive)\nA: hello';
    const { turns } = normalize(raw);
    expect(turns).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'agent', text: 'hello' },
    ]);
  });

  it('collapses 3+ blank lines down to 2', () => {
    const raw = 'USER: hi\n\n\n\n\nA: hello';
    // parseTurns just cares about non-empty lines, so this mainly verifies
    // normalize doesn't throw/misbehave on heavily-padded input and still parses both turns
    const { turns } = normalize(raw);
    expect(turns).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'agent', text: 'hello' },
    ]);
  });

  it('recognizes USER/A/ASSISTANT/AGENT role markers case-insensitively', () => {
    const raw = 'user: hi\nassistant: hello\nUSER: bye\nAGENT: goodbye';
    const { turns } = normalize(raw);
    expect(turns).toEqual([
      { role: 'user', text: 'hi' },
      { role: 'agent', text: 'hello' },
      { role: 'user', text: 'bye' },
      { role: 'agent', text: 'goodbye' },
    ]);
  });

  it('merges multi-line continuation text into the current turn', () => {
    const raw = 'A: this is a long answer\nthat continues\non multiple lines';
    const { turns } = normalize(raw);
    expect(turns).toEqual([
      { role: 'agent', text: 'this is a long answer that continues on multiple lines' },
    ]);
  });

  it('drops turns that end up with empty text', () => {
    const raw = 'USER: \nA: hello';
    const { turns } = normalize(raw);
    expect(turns).toEqual([{ role: 'agent', text: 'hello' }]);
  });

  it('returns empty turns when there are no recognizable role markers', () => {
    expect(normalize('just some plain text with no markers').turns).toEqual([]);
  });
});
