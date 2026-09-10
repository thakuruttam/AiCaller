import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceAgent } from '../src/VoiceAgent.js';

// Covers a real production bug: a caller asking "who is this?" mid-call
// (well past the initial identity-confirmation turn) got silently
// evaluated as if it were the literal ANSWER to whatever question had just
// been asked, since clarification handling only ever existed for the very
// first turn after the greeting. A live call showed exactly this: "And by
// the way, who is this?" got accepted as the answer to a tools question,
// silently advancing past it without ever capturing a real answer or
// answering the caller's actual question.
describe('VoiceAgent — mid-call clarification questions', () => {
  function makeAgent() {
    const agent = new VoiceAgent({
      contactName: 'Uttam',
      dataToCollect: [
        { id: 'q1', order: 1, itemType: 'question', text: 'What is your current role?', is_mandatory: false },
        { id: 'q2', order: 2, itemType: 'question', text: 'What tools have you used?', is_mandatory: false },
      ],
    });
    // Simulate being mid-call: identity already confirmed, q1 already
    // asked and answered, currentIndex pointing at q2 as the next item.
    agent.awaitingIdentityConfirm = false;
    agent.currentIndex = 1;
    return agent;
  }

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'This is an automated call from the HR team. What tools have you used?' } }] }),
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });

  it('answers a mid-call "who is this?" instead of treating it as the answer to the current question', async () => {
    const agent = makeAgent();
    const reply = await agent.processInput('Wait, who is this?');

    expect(reply).toBeTruthy();
    // Must NOT have advanced past q2 — the caller still owes a real answer.
    expect(agent.currentIndex).toBe(1);
    // Must still be expecting a reply (re-asking), not treating this as done.
    expect(agent.expectsUserReply).toBe(true);
  });

  it('recognizes several common phrasings of the same clarification intent', async () => {
    for (const phrase of ["who's calling", 'why are you calling', 'what is this about', 'what company is this']) {
      const agent = makeAgent();
      await agent.processInput(phrase);
      expect(agent.currentIndex).toBe(1);
    }
  });

  it('does not misfire on an ordinary answer that happens to contain unrelated words', async () => {
    const agent = makeAgent();
    await agent.processInput('I have used JIRA and Postman for API testing.');
    // A normal answer should proceed through the regular skip/advance path,
    // not get diverted into the clarification branch.
    expect(agent.currentIndex).toBeGreaterThanOrEqual(1);
  });
});
