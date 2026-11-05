import { describe, it, expect, afterEach } from 'vitest';
import { VoiceAgent } from '../src/VoiceAgent.js';
import {
  buildConversationInstructions, normalizeConversation,
  CONVERSATION_END_REASONS, KNOWLEDGE_MAX_CHARS, MAX_RULES,
} from '../src/utils/conversationPrompt.js';

const conversation = {
  objectivePreset: 'book_meeting',
  knowledge: 'Acme CRM costs ₹999 per user per month. Free 14-day trial. Setup takes one day.',
  rules: { never: ['Offer discounts'], always: ['Mention the free trial'] },
  endWhen: { endOnObjective: true, acceptFirstNo: false },
};

describe('normalizeConversation', () => {
  it('fills defaults for a missing or malformed value', () => {
    expect(normalizeConversation(null)).toEqual({
      objectivePreset: 'custom',
      knowledge: '',
      rules: { never: [], always: [] },
      endWhen: { endOnObjective: true, acceptFirstNo: false },
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
    expect(text).toMatch(/State only facts written in the KNOWLEDGE/);
    expect(text).toMatch(/Never guess or invent prices, discounts, dates/);
    expect(text).toMatch(/the team will follow up/);
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
    expect(build({ conversation: { ...conversation, endWhen: { endOnObjective: false } } }))
      .toMatch(/answer any remaining questions they have/);
  });

  it('includes the custom end condition and the time limit when set', () => {
    const text = build({ endCallIf: 'They already use a CRM they love.', maxMinutes: 5 });
    expect(text).toContain('They already use a CRM they love.');
    expect(text).toContain('at most 5 minutes');
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
