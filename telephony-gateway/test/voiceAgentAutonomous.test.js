import { describe, it, expect, beforeEach } from 'vitest';
import { VoiceAgent } from '../src/VoiceAgent.js';

// Covers VoiceAgent's role in autonomous (free-flowing, tool-calling) mode:
// a passive ledger reacting to the model's own tool calls, since there's no
// per-turn decision call to attach validation to like decision-engine mode's
// _resolveAction. No mocked fetch here — none of these methods call the LLM,
// that's the whole point of this mode (the Realtime session IS the brain).

function makeAgent(overrides = {}) {
  return new VoiceAgent({
    contactName: 'Uttam',
    callSignOff: 'Thank you for your time. Goodbye.',
    dataToCollect: [
      { id: 'q1', order: 1, itemType: 'question', text: 'What is your current role?' },
      { id: 'q2', order: 2, itemType: 'question', text: 'What tools have you used?' },
      { id: 'q3', order: 3, itemType: 'question', text: 'Are you open to relocate?' }
    ],
    useAutonomousEngine: true,
    ...overrides
  });
}

describe('VoiceAgent — autonomous mode ledger', () => {
  it('recordAnswerCaptured advances the pointer to just past the given item', () => {
    const agent = makeAgent();
    agent.recordAnswerCaptured('q1');
    expect(agent.currentIndex).toBe(1);
    expect(agent.currentItem().id).toBe('q2');
  });

  it('recordAnswerCaptured marks the call done once the last item is captured', () => {
    const agent = makeAgent();
    agent.currentIndex = 2;
    agent.recordAnswerCaptured('q3');
    expect(agent.done).toBe(true);
    expect(agent.currentItem()).toBeNull();
  });

  it('ignores an unknown item id rather than trusting it blindly', () => {
    const agent = makeAgent();
    agent.recordAnswerCaptured('does-not-exist');
    expect(agent.currentIndex).toBe(0);
  });

  it('ignores answer_captured for an already-covered item (no backward movement)', () => {
    const agent = makeAgent();
    agent.currentIndex = 2; // q1, q2 already covered
    agent.recordAnswerCaptured('q1');
    expect(agent.currentIndex).toBe(2);
  });

  it('recordSkip jumps forward to the target item', () => {
    const agent = makeAgent();
    agent.recordSkip('q3');
    expect(agent.currentIndex).toBe(2);
    expect(agent.currentItem().id).toBe('q3');
  });

  it('recordSkip rejects a backward jump', () => {
    const agent = makeAgent();
    agent.currentIndex = 2;
    agent.recordSkip('q1');
    expect(agent.currentIndex).toBe(2);
  });

  it('recordEndCall sets shouldHangUp and done regardless of reason', () => {
    const agent = makeAgent();
    agent.recordEndCall('declined');
    expect(agent.shouldHangUp).toBe(true);
    expect(agent.done).toBe(true);
  });

  it('appendTranscriptTurn pushes into chatHistory for saveTranscript() to read via getHistory()', () => {
    const agent = makeAgent();
    agent.appendTranscriptTurn('user', 'I work in QA.');
    agent.appendTranscriptTurn('assistant', 'Great, what tools have you used?');
    const history = agent.getHistory().filter(m => m.role !== 'system');
    expect(history).toEqual([
      { role: 'user', content: 'I work in QA.' },
      { role: 'assistant', content: 'Great, what tools have you used?' }
    ]);
  });

  it('does not stall until enough consecutive turns pass with no recorded progress', () => {
    const agent = makeAgent();
    agent.noteAutonomousTurn();
    agent.noteAutonomousTurn();
    expect(agent.isAutonomousStalled()).toBe(false);
    agent.noteAutonomousTurn();
    agent.noteAutonomousTurn();
    expect(agent.isAutonomousStalled()).toBe(true);
  });

  it('recording any progress resets the stall counter', () => {
    const agent = makeAgent();
    agent.noteAutonomousTurn();
    agent.noteAutonomousTurn();
    agent.noteAutonomousTurn();
    agent.noteAutonomousTurn();
    expect(agent.isAutonomousStalled()).toBe(true);
    agent.recordAnswerCaptured('q1');
    expect(agent.isAutonomousStalled()).toBe(false);
  });

  it('generateAutonomousInstructions includes the goal, ordered items, and the tool-calling contract', () => {
    const agent = makeAgent({ goal: 'Screen candidates for a QA role.' });
    const instructions = agent.generateAutonomousInstructions();
    expect(instructions).toContain('Screen candidates for a QA role.');
    expect(instructions).toContain('What is your current role?');
    expect(instructions).toContain('answer_captured');
    expect(instructions).toContain('skip_to_question');
    expect(instructions).toContain('end_call');
  });
});
