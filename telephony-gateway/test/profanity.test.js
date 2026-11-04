import { describe, it, expect } from 'vitest';
import { containsProfanity, maskProfanity, politeHangupLine } from '../src/utils/profanity.js';
import { VoiceAgent } from '../src/VoiceAgent.js';

describe('profanity detection', () => {
  it('flags English, Romanised Hindi and Devanagari cuss words', () => {
    expect(containsProfanity('this is fucking ridiculous')).toBe(true);
    expect(containsProfanity('Bullshit, I never signed up')).toBe(true);
    expect(containsProfanity('tu chutiya hai kya')).toBe(true);
    expect(containsProfanity('BHENCHOD band karo')).toBe(true);
    expect(containsProfanity('तू हरामी है')).toBe(true);
  });

  it('flags words speech-to-text already starred out', () => {
    expect(containsProfanity('what the f*** is this')).toBe(true);
    expect(containsProfanity('s**t, not again')).toBe(true);
  });

  it('does not flag ordinary words that merely contain a cuss word', () => {
    for (const text of ['I am in class right now', 'please assess my profile', 'Scunthorpe office', 'I passed the exam',
      'chhod do, baad mein baat karte hain', 'mera kutta bimar hai', 'Dick Smith is our CEO', '']) {
      expect(containsProfanity(text)).toBe(false);
    }
  });
});

describe('maskProfanity', () => {
  it('removes cuss words and tidies the text so TTS reads it naturally', () => {
    expect(maskProfanity('What the fuck is your current role?')).toBe('What the is your current role?');
    expect(maskProfanity('Bullshit, tell me your budget.')).toBe('tell me your budget.');
    expect(maskProfanity('आप हरामी कैसे हैं?')).toBe('आप कैसे हैं?');
  });

  it('returns clean text unchanged, including empty values', () => {
    expect(maskProfanity('What is your budget?')).toBe('What is your budget?');
    expect(maskProfanity(undefined)).toBe(undefined);
    expect(maskProfanity('')).toBe('');
  });
});

describe('politeHangupLine', () => {
  it('speaks the campaign language and falls back to English', () => {
    expect(politeHangupLine('Hindi')).toMatch(/धन्यवाद/);
    expect(politeHangupLine('Hinglish')).toMatch(/dhanyavaad/);
    expect(politeHangupLine('English')).toMatch(/Goodbye/);
    expect(politeHangupLine('Tamil')).toBe(politeHangupLine('English'));
  });
});

function makeAgent(overrides = {}) {
  return new VoiceAgent({
    contactName: 'Uttam',
    goal: 'Ask about the shitty experience with our product',
    callIntro: 'Hello, this is Priya calling about your damn order, bastard.',
    callSignOff: 'Thanks, goodbye.',
    dataToCollect: [
      { id: 'q1', order: 1, itemType: 'question', text: 'What the fuck is your current role?' },
      { id: 'q2', order: 2, itemType: 'question', text: 'Bullshit' },
      { id: 'q3', order: 3, itemType: 'question', text: 'What tools have you used?' },
    ],
    ...overrides,
  });
}

describe('VoiceAgent — never speaks profanity from the script', () => {
  it('cleans the goal, intro, sign-off and every question when the agent is created', () => {
    const agent = makeAgent();
    expect(agent.config.goal).toBe('Ask about the experience with our product');
    expect(agent.config.callIntro).toBe('Hello, this is Priya calling about your damn order.');
    expect(agent.items.map(i => i.text)).toEqual(['What the is your current role?', 'What tools have you used?']);
  });

  it('masks profanity in anything the model replies with', () => {
    const agent = makeAgent();
    expect(agent.sanitizeReply('Got it. What the fuck is your role? HANGUP_NOW')).toBe('Got it. What the is your role?');
  });

  it('tells the autonomous model never to swear', () => {
    expect(makeAgent({ useAutonomousEngine: true }).generateAutonomousInstructions()).toMatch(/Never say any swear word/);
  });
});

describe('VoiceAgent — a caller who swears is politely hung up on', () => {
  it('returns a polite goodbye in the campaign language and ends the call without asking the model', async () => {
    const agent = makeAgent({ language: 'Hinglish' });
    const reply = await agent.processInput('tu chutiya hai, phone rakh');
    expect(reply).toBe(politeHangupLine('Hinglish'));
    expect(agent.shouldHangUp).toBe(true);
    expect(agent.done).toBe(true);
    expect(agent.getHistory().slice(-2)).toEqual([
      { role: 'user', content: 'tu chutiya hai, phone rakh' },
      { role: 'assistant', content: politeHangupLine('Hinglish') },
    ]);
  });

  it('also applies in decision-engine mode', async () => {
    const agent = makeAgent({ useDecisionEngine: true });
    const reply = await agent.processInput('fuck off');
    expect(reply).toBe(politeHangupLine('English'));
    expect(agent.shouldHangUp).toBe(true);
  });

  it('never treats our own system directives as the caller swearing', async () => {
    const agent = makeAgent();
    agent._processInputLegacy = async () => 'legacy path ran';
    const reply = await agent.processInput('(System: State this information verbatim: "Bullshit". Then continue.)');
    expect(reply).toBe('legacy path ran');
    expect(agent.shouldHangUp).toBe(false);
  });
});
