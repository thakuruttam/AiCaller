import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceAgent } from '../src/VoiceAgent.js';

// Covers the new decision-engine path (realtime-engine calls only,
// useDecisionEngine: true) that replaces the old keyword-list detectors
// (CLARIFICATION_PHRASES, NEGATIVE_WORDS, confusion phrases, DENIAL_*) with
// a single LLM tool call. The model only ever picks an action — these tests
// assert that whatever it picks resolves to the right VERBATIM text and
// state change, entirely from code, never from LLM-composed text. The
// legacy path (useDecisionEngine unset/false) is untouched and still
// covered by voiceAgentClarification.test.js / voiceAgentCondition.test.js.

function mockToolCallResponse(args) {
  return {
    ok: true,
    json: async () => ({
      choices: [{
        message: {
          role: 'assistant',
          tool_calls: [{
            id: 'call_1',
            type: 'function',
            function: { name: 'take_action', arguments: JSON.stringify(args) }
          }]
        }
      }]
    })
  };
}

function makeAgent(overrides = {}) {
  return new VoiceAgent({
    contactName: 'Uttam',
    callSignOff: 'Thank you for your time. Goodbye.',
    callIntro: 'Hi, this is an automated call from Acme HR.',
    dataToCollect: [
      { id: 'q1', order: 1, itemType: 'question', text: 'What is your current role?' },
      { id: 'q2', order: 2, itemType: 'question', text: 'What tools have you used?' },
      { id: 'q3', order: 3, itemType: 'question', text: 'Are you open to relocate?' }
    ],
    useDecisionEngine: true,
    ...overrides
  });
}

describe('VoiceAgent — decision engine (realtime path)', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-key';
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
    delete process.env.MAX_REPEAT_ACTIONS;
  });

  it('ask_item during identity confirmation asks the first item verbatim, with a "Thanks." prefix', async () => {
    const agent = makeAgent();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockToolCallResponse({ action: 'ask_item', item_id: 'q1' })));

    const reply = await agent.processInput('Yes, speaking.');

    expect(reply).toBe('Thanks. What is your current role?');
    expect(agent.awaitingIdentityConfirm).toBe(false);
    expect(agent.identityConfirmed).toBe(true);
    expect(agent.currentIndex).toBe(1);
    expect(agent.expectsUserReply).toBe(true);
  });

  it('wrong_person hangs up with the exact apology, no matter what phrasing triggered it', async () => {
    const agent = makeAgent();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockToolCallResponse({ action: 'wrong_person' })));

    const reply = await agent.processInput("You've got the wrong guy, mate.");

    expect(reply).toBe('I apologize for the confusion. Have a great day.');
    expect(agent.shouldHangUp).toBe(true);
    expect(agent.done).toBe(true);
  });

  it('repeat_current re-asks the exact previous question, unchanged pointer, no filler prefix', async () => {
    const agent = makeAgent();
    agent.awaitingIdentityConfirm = false;
    agent.currentIndex = 2; // q1 already asked, q2 is "next up"

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockToolCallResponse({ action: 'repeat_current' })));
    const reply = await agent.processInput('Sorry, what was that?');

    expect(reply).toBe('What tools have you used?');
    expect(agent.currentIndex).toBe(2);
    expect(agent.expectsUserReply).toBe(true);
  });

  it('explain_and_continue answers a novel "who is this" phrasing then repeats the previous question — no hardcoded phrase list involved', async () => {
    const agent = makeAgent();
    agent.awaitingIdentityConfirm = false;
    agent.currentIndex = 2;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockToolCallResponse({ action: 'explain_and_continue' })));
    // Deliberately NOT a phrase from the old CLARIFICATION_PHRASES list —
    // the whole point is this no longer depends on string matching.
    const reply = await agent.processInput('Hold on, who exactly am I talking to here?');

    expect(reply).toBe('Hi, this is an automated call from Acme HR. What tools have you used?');
    expect(agent.currentIndex).toBe(2);
  });

  it('the mid-script decision prompt explicitly directs "who is this"-style questions to explain_and_continue, not just repeat_current', async () => {
    // Confirmed on a live call: the mid-script prompt used to only mention
    // clarification questions in a generic closing sentence, and the model
    // repeatedly just repeated the question bare instead of answering who
    // was calling. The identity-confirmation phase already had this as a
    // concrete worked example and never had the problem — this locks in
    // that the script phase now gets the same concrete instruction.
    const agent = makeAgent();
    agent.awaitingIdentityConfirm = false;
    agent.currentIndex = 1;

    const fetchMock = vi.fn().mockResolvedValue(mockToolCallResponse({ action: 'repeat_current' }));
    vi.stubGlobal('fetch', fetchMock);
    await agent.processInput('Who is this?');

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const systemMessage = body.messages.find(m => m.role === 'system').content;
    expect(systemMessage).toContain('explain_and_continue');
    expect(systemMessage.toLowerCase()).toContain('who is this');
  });

  it('a genuine decline/reschedule ("not a good time") ends the call instead of asking the next question — the real bug this replaces', async () => {
    const agent = makeAgent();
    agent.awaitingIdentityConfirm = false;
    agent.currentIndex = 2;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockToolCallResponse({ action: 'end_call', end_reason: 'declined' })));
    const reply = await agent.processInput("Actually, it's not a good time to talk. Can we talk some other time?");

    expect(reply).toBe('I apologize for the interruption. Have a great day.');
    expect(agent.shouldHangUp).toBe(true);
    expect(agent.done).toBe(true);
  });

  it('end_call{completed} speaks the configured sign-off verbatim', async () => {
    const agent = makeAgent();
    agent.awaitingIdentityConfirm = false;
    agent.currentIndex = 3;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockToolCallResponse({ action: 'end_call', end_reason: 'completed' })));
    const reply = await agent.processInput('That covers everything I think.');

    expect(reply).toBe('Thank you for your time. Goodbye.');
    expect(agent.shouldHangUp).toBe(true);
  });

  it('skip_to_item jumps forward to the requested item and speaks it verbatim', async () => {
    const agent = makeAgent();
    agent.awaitingIdentityConfirm = false;
    agent.currentIndex = 1; // q1 asked, q2 next up

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockToolCallResponse({ action: 'skip_to_item', item_id: 'q3' })));
    const reply = await agent.processInput("I've only ever done manual testing, no automation tools at all.");

    expect(reply).toBe('Thanks. Are you open to relocate?');
    expect(agent.currentIndex).toBe(3);
  });

  it('rejects a backward skip_to_item and falls back to asking the next item in order', async () => {
    const agent = makeAgent();
    agent.awaitingIdentityConfirm = false;
    agent.currentIndex = 2; // q1, q2 already asked, q3 next up

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockToolCallResponse({ action: 'skip_to_item', item_id: 'q1' })));
    const reply = await agent.processInput('Something unrelated.');

    expect(reply).toBe('Thanks. Are you open to relocate?');
    expect(agent.currentIndex).toBe(3);
  });

  it('caps consecutive repeat/explain actions so a confused caller cannot stall the call forever', async () => {
    process.env.MAX_REPEAT_ACTIONS = '2';
    const agent = makeAgent();
    agent.awaitingIdentityConfirm = false;
    agent.currentIndex = 1; // q2 is next up

    const fetchMock = vi.fn().mockResolvedValue(mockToolCallResponse({ action: 'repeat_current' }));
    vi.stubGlobal('fetch', fetchMock);

    await agent.processInput("What?");
    await agent.processInput("Sorry, what?");
    const thirdReply = await agent.processInput("I still didn't catch that.");

    // Third consecutive repeat/explain exceeds the cap — forced to move on.
    expect(thirdReply).toBe('Thanks. What tools have you used?');
    expect(agent.currentIndex).toBe(2);
  });

  it('falls back to asking the next item in order if the decision call fails outright', async () => {
    const agent = makeAgent();
    agent.awaitingIdentityConfirm = false;
    agent.currentIndex = 1;

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network blip')));
    const reply = await agent.processInput('I use JIRA mostly.');

    expect(reply).toBe('Thanks. What tools have you used?');
    expect(agent.currentIndex).toBe(2);
  });

  it('falls back to asking the next item in order if the model returns a disallowed action', async () => {
    const agent = makeAgent();
    agent.awaitingIdentityConfirm = false;
    agent.currentIndex = 1;

    // wrong_person is not in the allowed set for a normal script turn.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockToolCallResponse({ action: 'wrong_person' })));
    const reply = await agent.processInput('I use JIRA mostly.');

    expect(reply).toBe('Thanks. What tools have you used?');
    expect(agent.currentIndex).toBe(2);
  });
});
