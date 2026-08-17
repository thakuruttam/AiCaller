import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceAgent } from '../src/VoiceAgent.js';

// These tests cover the LLM-bypass optimization: scripted turns whose text is
// already fully known (plain questions, info statements, sign-off, greeting,
// confusion-repeat) should be spoken directly without an OpenAI round trip.
// Turns that need real reasoning (mandatory-answer judgment, multi-info
// chains, non-English translation, identity clarification) must still hit
// the LLM — verified here via a fetch spy rather than assuming behavior.

function makeAgent(overrides = {}) {
  return new VoiceAgent({
    name: 'Test Campaign',
    contactName: 'Alex',
    goal: 'Collect info',
    callIntro: 'Hi, this is a test call.',
    callSignOff: 'Thanks, goodbye.',
    dataToCollect: [
      { id: 'q1', itemType: 'question', text: 'What is your [role]?', is_mandatory: false },
      { id: 'q2', itemType: 'question', text: 'What is your budget?', is_mandatory: false },
    ],
    language: 'English',
    ...overrides,
  });
}

function mockFetchOnce(replyText = 'ok') {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content: replyText } }] }),
    text: async () => '',
  });
}

describe('VoiceAgent.sayVerbatim', () => {
  it('pushes an assistant turn and sets flags without touching the LLM', () => {
    const agent = makeAgent();
    const fetchSpy = mockFetchOnce();
    vi.stubGlobal('fetch', fetchSpy);

    const result = agent.sayVerbatim('Hello there.', { expectsUserReply: true });

    expect(result).toBe('Hello there.');
    expect(agent.expectsUserReply).toBe(true);
    expect(agent.shouldHangUp).toBe(false);
    expect(agent.getHistory().at(-1)).toEqual({ role: 'assistant', content: 'Hello there.' });
    expect(fetchSpy).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('sets shouldHangUp when hangUp: true', () => {
    const agent = makeAgent();
    agent.sayVerbatim('Goodbye.', { hangUp: true });
    expect(agent.shouldHangUp).toBe(true);
  });
});

describe('VoiceAgent.lastReplyWasBypass', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is false after a real LLM reply (non-English forces every turn onto the LLM)', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const fetchSpy = mockFetchOnce('llm reply');
    vi.stubGlobal('fetch', fetchSpy);

    const agent = makeAgent({ language: 'Hindi' }); // forces every turn onto the LLM path
    await agent.processInput('Yes speaking');
    expect(agent.lastReplyWasBypass).toBe(false);

    delete process.env.OPENAI_API_KEY;
  });

  it('is true for the deterministic English bypass path', () => {
    const agent = makeAgent();
    agent.sayVerbatim('Hi there.');
    expect(agent.lastReplyWasBypass).toBe(true);
  });

  it('is true for wrong-person and negative-sentiment hangups', async () => {
    const wrongPerson = makeAgent();
    await wrongPerson.processInput('wrong number'); // denial during identity confirmation
    expect(wrongPerson.lastReplyWasBypass).toBe(true);

    const refused = makeAgent();
    await refused.processInput('Yes speaking'); // confirm identity, asks Q1
    await refused.processInput('not interested, stop calling'); // negative sentiment mid-call
    expect(refused.lastReplyWasBypass).toBe(true);
  });
});

describe('VoiceAgent._buildBypass', () => {
  it('bypasses a plain non-mandatory question and strips [placeholder] brackets', () => {
    const agent = makeAgent();
    const result = agent._buildBypass();
    expect(result).toEqual({ text: 'What is your role?', expectsUserReply: true, hangUp: false });
    expect(agent.currentIndex).toBe(1);
  });

  it('bypasses asking a mandatory question too — validity is judged separately', () => {
    const agent = makeAgent({
      dataToCollect: [{ id: 'q1', itemType: 'question', text: 'Mandatory Q?', is_mandatory: true }],
    });
    const result = agent._buildBypass();
    expect(result).toEqual({ text: 'Mandatory Q?', expectsUserReply: true, hangUp: false });
    expect(agent.currentIndex).toBe(1);
  });

  it('returns null for any non-English campaign', () => {
    const agent = makeAgent({ language: 'Hindi' });
    const result = agent._buildBypass();
    expect(result).toBeNull();
    expect(agent.currentIndex).toBe(0);
  });

  it('chains a single info item into the following non-mandatory question', () => {
    const agent = makeAgent({
      dataToCollect: [
        { id: 'i1', itemType: 'information', text: 'We are open till 9pm.' },
        { id: 'q1', itemType: 'question', text: 'What time works for you?', is_mandatory: false },
      ],
    });
    const result = agent._buildBypass();
    expect(result).toEqual({
      text: 'We are open till 9pm. What time works for you?',
      expectsUserReply: true,
      hangUp: false,
    });
    expect(agent.currentIndex).toBe(2);
  });

  it('returns null for 2+ chained info items (leaves it to the LLM path)', () => {
    const agent = makeAgent({
      dataToCollect: [
        { id: 'i1', itemType: 'information', text: 'Info one.' },
        { id: 'i2', itemType: 'information', text: 'Info two.' },
      ],
    });
    const result = agent._buildBypass();
    expect(result).toBeNull();
    expect(agent.currentIndex).toBe(0);
  });

  it('chains info into a mandatory question too', () => {
    const agent = makeAgent({
      dataToCollect: [
        { id: 'i1', itemType: 'information', text: 'Info.' },
        { id: 'q1', itemType: 'question', text: 'Mandatory Q?', is_mandatory: true },
      ],
    });
    const result = agent._buildBypass();
    expect(result).toEqual({ text: 'Info. Mandatory Q?', expectsUserReply: true, hangUp: false });
    expect(agent.currentIndex).toBe(2);
  });

  it('closes the call with sign-off + hangUp when a trailing info item is the last item', () => {
    const agent = makeAgent({
      dataToCollect: [{ id: 'i1', itemType: 'information', text: 'Final notice.' }],
      callSignOff: 'Bye now.',
    });
    const result = agent._buildBypass();
    expect(result).toEqual({ text: 'Final notice. Bye now.', expectsUserReply: false, hangUp: true });
    expect(agent.done).toBe(true);
  });

  it('closes the call once items are exhausted', () => {
    const agent = makeAgent({ dataToCollect: [], callSignOff: 'All done, bye.' });
    const result = agent._buildBypass();
    expect(result).toEqual({ text: 'All done, bye.', expectsUserReply: false, hangUp: true });
    expect(agent.done).toBe(true);
  });

  it('returns null once already done (defers to the existing no-op path)', () => {
    const agent = makeAgent({ dataToCollect: [] });
    agent.done = true;
    expect(agent._buildBypass()).toBeNull();
  });
});

describe('VoiceAgent.continueWithoutUser', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('bypasses the LLM for a deterministic auto-advance', async () => {
    const agent = makeAgent();
    const fetchSpy = mockFetchOnce();
    vi.stubGlobal('fetch', fetchSpy);

    const reply = await agent.continueWithoutUser();

    expect(reply).toBe('What is your role?');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('VoiceAgent.processInput — scripted turns bypass the LLM', () => {
  let fetchSpy;
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    fetchSpy = mockFetchOnce();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });

  it('confirms identity and asks Q1 without calling the LLM (non-mandatory, English)', async () => {
    const agent = makeAgent();
    const reply = await agent.processInput('Yes speaking');

    expect(reply).toBe('Thanks. What is your role?');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(agent.expectsUserReply).toBe(true);
  });

  it('advances to Q2 without calling the LLM once Q1 is answered', async () => {
    const agent = makeAgent();
    await agent.processInput('Yes speaking'); // asks Q1
    const reply = await agent.processInput('Engineer');

    expect(reply).toBe('What is your budget?');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('closes the call with sign-off once all questions are answered', async () => {
    const agent = makeAgent();
    await agent.processInput('Yes speaking');       // asks Q1
    await agent.processInput('Engineer');            // asks Q2
    const reply = await agent.processInput('50k');   // exhausts items

    expect(reply).toBe('Thanks, goodbye.');
    expect(agent.shouldHangUp).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('still calls the LLM for a non-English campaign', async () => {
    const agent = makeAgent({ language: 'Hindi' });
    await agent.processInput('Yes speaking');
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('bypasses the LLM on confusion-retry (English) with a canned apology', async () => {
    const agent = makeAgent();
    await agent.processInput('Yes speaking'); // asks Q1: "What is your role?"
    fetchSpy.mockClear();

    const reply = await agent.processInput('what?');

    expect(reply).toBe('Sorry about that. What is your role?');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('still hangs up immediately on wrong-person detection without calling the LLM', async () => {
    const agent = makeAgent();
    const reply = await agent.processInput('wrong number');

    expect(reply).toBe('I apologize for the confusion. Have a great day.');
    expect(agent.shouldHangUp).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('VoiceAgent — mandatory-answer validation (condition-based)', () => {
  let fetchSpy;
  const mandatoryAgent = () => makeAgent({
    dataToCollect: [
      {
        id: 'q1', itemType: 'question', text: 'What is your role?', is_mandatory: true,
        expectedAnswer: { condition: 'contains', value: 'engineer' },
      },
      { id: 'q2', itemType: 'question', text: 'What is your budget?', is_mandatory: false },
    ],
  });

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
    fetchSpy = mockFetchOnce();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });

  it('asks the mandatory question via bypass (no LLM call)', async () => {
    const agent = mandatoryAgent();
    const reply = await agent.processInput('Yes speaking');
    expect(reply).toBe('Thanks. What is your role?');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('re-asks verbatim (bypassed) when the answer fails the expectedAnswer condition', async () => {
    const agent = mandatoryAgent();
    await agent.processInput('Yes speaking'); // asks Q1

    const reply = await agent.processInput('I like pizza'); // no "engineer"

    expect(reply).toBe('What is your role?');
    expect(agent.mandatoryRetries).toBe(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('advances to Q2 once a valid answer satisfies the condition', async () => {
    const agent = mandatoryAgent();
    await agent.processInput('Yes speaking'); // asks Q1

    const reply = await agent.processInput('I am a software engineer');

    expect(reply).toBe('What is your budget?');
    expect(agent.mandatoryRetries).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('gives up after MAX_MANDATORY_RETRIES and moves on with the best-effort answer', async () => {
    process.env.MAX_MANDATORY_RETRIES = '2';
    const agent = mandatoryAgent();
    await agent.processInput('Yes speaking');       // asks Q1
    await agent.processInput('pizza');               // invalid, retry 1
    await agent.processInput('cats');                // invalid, retry 2
    const reply = await agent.processInput('dogs');  // invalid again, retries exhausted

    expect(reply).toBe('What is your budget?'); // moved on despite invalid answer
    expect(agent.mandatoryRetries).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    delete process.env.MAX_MANDATORY_RETRIES;
  });

  it('defaults to "is any value" (non-empty) when no expectedAnswer is configured', async () => {
    const agent = makeAgent({
      dataToCollect: [{ id: 'q1', itemType: 'question', text: 'Anything?', is_mandatory: true }],
    });
    await agent.processInput('Yes speaking'); // asks Q1

    const reply = await agent.processInput('sure, whatever');

    expect(reply).toBe('Thanks, goodbye.'); // advanced straight to closure — any non-empty answer was valid
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('lets a matching skip/end_call condition on the same mandatory item take priority over validity checks', async () => {
    const agent = makeAgent({
      dataToCollect: [{
        id: 'q1', itemType: 'question', text: 'Are you interested?', is_mandatory: true,
        expectedAnswer: { condition: 'contains', value: 'yes' },
        onAnswer: { action: 'end_call', skipCondition: { condition: 'contains', value: 'no thanks' } },
      }],
    });
    await agent.processInput('Yes speaking'); // asks Q1

    // Fails the mandatory "contains yes" check AND matches the end_call condition —
    // end_call must win, not an infinite mandatory-retry loop.
    const reply = await agent.processInput('no thanks.');

    expect(reply).toBe('Thanks, goodbye.');
    expect(agent.shouldHangUp).toBe(true);
    expect(agent.mandatoryRetries).toBe(0);
  });
});

describe('VoiceAgent — mandatory-answer validation (semantic)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('calls the LLM once for a semantic validity classification, then bypasses the repeat', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const fetchSpy = mockFetchOnce('no'); // classifier says the answer does NOT satisfy the criteria
    vi.stubGlobal('fetch', fetchSpy);

    const agent = makeAgent({
      dataToCollect: [{
        id: 'q1', itemType: 'question', text: 'What is your experience?', is_mandatory: true,
        scoringActiveTab: 'semantic', scoringCriteria: 'mentions relevant work experience',
      }],
    });
    await agent.processInput('Yes speaking'); // asks Q1 — bypassed
    expect(fetchSpy).not.toHaveBeenCalled();

    const reply = await agent.processInput('I like cats');

    expect(fetchSpy).toHaveBeenCalledTimes(1); // one classification call
    expect(reply).toBe('What is your experience?'); // repeat is still bypassed
    expect(agent.mandatoryRetries).toBe(1);

    delete process.env.OPENAI_API_KEY;
  });
});
