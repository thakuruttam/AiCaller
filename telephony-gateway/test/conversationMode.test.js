import { describe, it, expect, afterEach } from 'vitest';
import { VoiceAgent } from '../src/VoiceAgent.js';
import {
  buildConversationInstructions, normalizeConversation,
  CONVERSATION_END_REASONS, CONVERSATION_LANGUAGES, KNOWLEDGE_MAX_CHARS, MAX_RULES, UNKNOWN_ANSWER, UNKNOWN_ANSWER_HINGLISH,
} from '../src/utils/conversationPrompt.js';

const conversation = {
  objectivePreset: 'book_meeting',
  knowledge: 'Acme CRM costs ₹999 per user per month. Free 14-day trial. Setup takes one day.',
  rules: { never: ['Offer discounts'], always: ['Mention the free trial'] },
  endWhen: { acceptFirstNo: false },
  detailsToCollect: ['Email', 'Preferred demo time'],
  availability: 'Mon–Fri, 10am–6pm IST',
};

describe('normalizeConversation', () => {
  it('fills defaults for a missing or malformed value', () => {
    expect(normalizeConversation(null)).toEqual({
      objectivePreset: 'custom',
      knowledge: '',
      rules: { never: [], always: [] },
      detailsToCollect: [],
      availability: '',
      endWhen: { acceptFirstNo: false },
    });
    expect(normalizeConversation('nonsense').rules.never).toEqual([]);
  });

  it('bounds the knowledge base and rules so a paste cannot blow up every call', () => {
    const c = normalizeConversation({
      knowledge: 'x'.repeat(KNOWLEDGE_MAX_CHARS + 500),
      rules: { never: [' a ', '', null, ...Array.from({ length: 30 }, (_, i) => `r${i}`)] },
    });
    expect(c.knowledge).toHaveLength(KNOWLEDGE_MAX_CHARS);
    expect(c.rules.never[0]).toBe('a');
    expect(c.rules.never).toHaveLength(MAX_RULES);
  });
});

describe('buildConversationInstructions', () => {
  const build = (over = {}) => buildConversationInstructions({
    contactName: 'Uttam', objective: 'Book a 15-minute demo.', conversation, ...over,
  });

  it('carries the objective, the knowledge and the rules', () => {
    const text = build();
    expect(text).toContain('OBJECTIVE: Book a 15-minute demo.');
    expect(text).toContain('₹999 per user per month');
    expect(text).toContain('- Offer discounts');
    expect(text).toContain('- Mention the free trial');
  });

  it('forbids stating anything outside the knowledge base', () => {
    const text = build();
    expect(text).toMatch(/The KNOWLEDGE above is everything you know/);
    expect(text).toMatch(/check that it is written in the KNOWLEDGE/);
    expect(text).toMatch(/Do not add a guess, a "typically", an "often"/);
  });

  it('forbids outside knowledge, guessing from names and health advice', () => {
    // Live call 2026-11-05: product names only in the knowledge, yet the agent
    // explained what each was for and recommended one for fatigue.
    const text = build();
    expect(text).toMatch(/You have NO other knowledge about any product, brand/);
    expect(text).toMatch(/A name is not information/);
    expect(text).toMatch(/don't ask the caller about needs the KNOWLEDGE doesn't link to an item/);
    expect(text).toMatch(/Never give medical, health, legal or financial advice/);
    expect(text).toContain(`say exactly: "${UNKNOWN_ANSWER}"`);
  });

  it('needs a clear yes before the objective counts as reached', () => {
    expect(build()).toMatch(/only when the caller gives a clear, unambiguous yes/);
    expect(build()).toMatch(/"sure, whatever", "hmm", a number/);
  });

  it('with no knowledge, tells the agent it can state no product facts at all', () => {
    const text = build({ conversation: { ...conversation, knowledge: '' } });
    expect(text).toContain('KNOWLEDGE: none was provided');
  });

  it('names every end reason and never invites a self-made goodbye', () => {
    const text = build();
    for (const reason of CONVERSATION_END_REASONS) expect(text).toContain(reason);
    expect(text).toMatch(/Do not say a goodbye or closing words of your own/);
  });

  it('follows the end-of-call settings', () => {
    expect(build()).toMatch(/address their concern ONCE/);
    expect(build({ conversation: { ...conversation, endWhen: { acceptFirstNo: true } } }))
      .toMatch(/Do not try to change their mind/);
  });

  it('always ends once the objective is reached, and when the call goes nowhere', () => {
    // Live call 2026-11-05 kept going after the caller agreed, chasing an email.
    const text = build();
    expect(text).toMatch(/It counts as reached as soon as that clear yes is given/);
    expect(text).toMatch(/Do not keep talking once it is reached/);
    expect(text).toMatch(/no_progress: if you have tried three times/);
    expect(build({ conversation: { ...conversation, endWhen: { endOnObjective: false } } }))
      .toMatch(/Do not keep talking once it is reached/);
  });

  it('says plainly what the agent cannot do', () => {
    // Same call: it offered slots, "booked" 4 AM and promised a calendar invite.
    const text = build();
    expect(text).toMatch(/You cannot book or confirm meetings, check calendars/);
    expect(text).toMatch(/Never say or imply that you will/);
    expect(text).toMatch(/Never say a meeting is booked or confirmed/);
  });

  it('asks only for the configured details, and for none when none are set', () => {
    const text = build();
    expect(text).toContain('- Email');
    expect(text).toContain('- Preferred demo time');
    expect(text).toMatch(/call capture_detail/);
    expect(build({ conversation: { ...conversation, detailsToCollect: [] } }))
      .toMatch(/Do not ask the caller for any personal or contact details/);
  });

  it('uses the availability window, or offers no times at all without one', () => {
    expect(build()).toContain('meetings can only happen Mon–Fri, 10am–6pm IST');
    expect(build({ conversation: { ...conversation, availability: '' } }))
      .toMatch(/accept whatever they say without suggesting or questioning times/);
  });

  it('keeps the opening short', () => {
    expect(build()).toMatch(/say in ONE short sentence why you're calling, then ask one question/);
  });

  it('includes the custom end condition and the time limit when set', () => {
    const text = build({ endCallIf: 'They already use a CRM they love.', maxMinutes: 5 });
    expect(text).toContain('They already use a CRM they love.');
    expect(text).toContain('cut off automatically after 5 minutes');
  });
});

describe('VoiceAgent in conversation mode', () => {
  afterEach(() => { delete process.env.MAX_AUTONOMOUS_STALL_TURNS; });

  const makeAgent = (over = {}) => new VoiceAgent({
    contactName: 'Uttam', goal: 'Book a 15-minute demo.', callSignOff: 'Thanks!',
    dataToCollect: [], useAutonomousEngine: true, mode: 'conversation', conversation, ...over,
  });

  it('uses the conversation instructions instead of the question list', () => {
    const text = makeAgent().generateAutonomousInstructions();
    expect(text).toContain('OBJECTIVE: Book a 15-minute demo.');
    expect(text).not.toContain('QUESTIONS TO COVER');
  });

  it('never trips the stall valve, which would otherwise hang up a normal conversation', () => {
    const agent = makeAgent();
    for (let i = 0; i < 20; i++) agent.noteAutonomousTurn();
    expect(agent.isAutonomousStalled()).toBe(false);
  });

  it('keeps only the details the campaign asked for', () => {
    const agent = makeAgent();
    expect(agent.recordDetail('email', ' uttam@example.com ')).toBe(true);
    expect(agent.recordDetail('Home address', '12 Main St')).toBe(false);
    expect(agent.recordDetail('Preferred demo time', '')).toBe(false);
    expect(agent.capturedDetails).toEqual({ Email: 'uttam@example.com' });
  });

  it('keeps the first end reason', () => {
    const agent = makeAgent();
    agent.recordEndCall('objective_met');
    agent.recordEndCall('time_limit');
    expect(agent.endReason).toBe('objective_met');
  });

  it('leaves question campaigns exactly as before', () => {
    const agent = makeAgent({ mode: undefined, dataToCollect: [{ id: 'q1', order: 1, itemType: 'question', text: 'Role?' }] });
    expect(agent.mode).toBe('questions');
    expect(agent.generateAutonomousInstructions()).toContain('QUESTIONS TO COVER');
    for (let i = 0; i < 20; i++) agent.noteAutonomousTurn();
    expect(agent.isAutonomousStalled()).toBe(true);
  });
});

describe('Hinglish calls', () => {
  it('conversation instructions open with the Hinglish directive and give the Hinglish fallback', () => {
    const text = buildConversationInstructions({ contactName: 'Uttam', objective: 'Book a demo.', conversation, language: 'Hinglish' });
    expect(text).toMatch(/^LANGUAGE — speak natural Hinglish/);
    expect(text).toContain(UNKNOWN_ANSWER_HINGLISH);
    expect(text).toContain('Keep names, product names, prices, numbers and technical terms in English');
  });

  it('English instructions carry no language directive', () => {
    const text = buildConversationInstructions({ contactName: 'Uttam', objective: 'Book a demo.', conversation, language: 'English' });
    expect(text).not.toMatch(/LANGUAGE —/);
    expect(text).not.toContain(UNKNOWN_ANSWER_HINGLISH);
  });

  it('question campaigns in Hinglish get the same directive', () => {
    const agent = new VoiceAgent({
      contactName: 'Uttam', language: 'Hinglish', useAutonomousEngine: true,
      dataToCollect: [{ id: 'q1', order: 1, itemType: 'question', text: 'What is your notice period?' }],
    });
    const text = agent.generateAutonomousInstructions();
    expect(text).toMatch(/^LANGUAGE — speak natural Hinglish/);
    expect(text).toContain('QUESTIONS TO COVER');
  });

  it('conversation campaigns can run in English or Hinglish', () => {
    expect(CONVERSATION_LANGUAGES).toEqual(['English', 'Hinglish']);
  });
});

describe('final rules block', () => {
  const build = (language) => buildConversationInstructions({ contactName: 'Uttam', objective: 'Sell a product.', conversation, language });

  it('ends every conversation prompt with the rules, in the language being spoken', () => {
    const hinglish = build('Hinglish');
    expect(hinglish.trimEnd()).toMatch(/Main <koi company> se baat kar raha hoon[\s\S]*$/);
    expect(hinglish.slice(hinglish.lastIndexOf('FINAL CHECK'))).toContain(UNKNOWN_ANSWER_HINGLISH);
    expect(hinglish.slice(hinglish.lastIndexOf('FINAL CHECK'))).toMatch(/Kisi bimari, takleef ya zaroorat/);
    const english = build('English');
    expect(english.slice(english.lastIndexOf('FINAL CHECK'))).toMatch(/Never suggest anything for an illness/);
    expect(english).not.toMatch(/Galat → Sahi/);
  });

  it('never names a real product or company in its examples, so nothing leaks into other campaigns', () => {
    for (const lang of ['English', 'Hinglish']) {
      const rules = build(lang).slice(build(lang).lastIndexOf('FINAL CHECK'));
      expect(rules).not.toMatch(/Patanjali|Divya|Madhunashini|Medha/);
    }
  });

  it('forbids naming a company the opening line does not', () => {
    expect(build('English')).toMatch(/never say who you are calling from unless the opening line or the KNOWLEDGE says it/);
  });
});
