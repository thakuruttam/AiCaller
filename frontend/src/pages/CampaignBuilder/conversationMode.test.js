import { describe, it, expect } from 'vitest';
import {
  CONVERSATION_TEMPLATES, KNOWLEDGE_MAX_CHARS, conversationStart, emptyPayload, fromCampaign,
  getReadiness, knowledgeWarning, testGreeting, wordCount,
} from './campaignModel';

const contacts = [{ name: 'Priya', phone: '+919876543210' }];

/** A conversation campaign that should be launchable, to break one thing at a time. */
function ready(over = {}) {
  const base = conversationStart('demo');
  return {
    ...base,
    name: 'Demo calls',
    goals: { goal: 'Book a demo.', callIntro: "Hi [Name], I'm calling from Acme.", callSignOff: 'Thanks!' },
    conversation: { ...base.conversation, knowledge: 'Acme CRM costs ₹999 per user per month.' },
    contacts,
    ...over,
  };
}
const texts = (p) => getReadiness(p).blockers.map(b => b.text);

describe('conversation campaigns in the builder model', () => {
  it('new payloads are question campaigns with a conversation ready to switch to', () => {
    const p = emptyPayload();
    expect(p.mode).toBe('questions');
    expect(p.conversation.endWhen).toEqual({ acceptFirstNo: false });
    expect(p.conversation.detailsToCollect).toEqual([]);
  });

  it('every template starts an English conversation with no question list and a gap to fill', () => {
    for (const tpl of CONVERSATION_TEMPLATES) {
      const p = conversationStart(tpl.key);
      expect(p.mode).toBe('conversation');
      expect(p.dataToCollect).toEqual([]);
      expect(p.callSettings.language).toBe('English');
      expect(p.conversation.rules.never.length).toBeGreaterThan(0);
      expect(getReadiness({ ...p, contacts }).blockers.some(b => b.field === 'knowledge')).toBe(true);
    }
  });

  it('a complete brief is ready, with no question or weight requirements', () => {
    const r = getReadiness(ready());
    expect(r.blockers).toEqual([]);
    expect(r.questions).toBe(0);
  });

  it('asks for an objective, an opening line and the knowledge', () => {
    expect(texts(ready({ goals: { goal: '', callIntro: 'Hi', callSignOff: '' } }))).toContain('Say what a successful call achieves.');
    expect(texts(ready({ goals: { goal: 'x', callIntro: '', callSignOff: '' } }))).toContain('Write the opening line.');
    expect(texts(ready({ conversation: { ...ready().conversation, knowledge: '  ' } }))[0]).toMatch(/Paste what the agent should know/);
  });

  it('blocks knowledge that is too long or still has [gaps]', () => {
    const long = ready({ conversation: { ...ready().conversation, knowledge: 'x'.repeat(KNOWLEDGE_MAX_CHARS + 1) } });
    expect(texts(long)[0]).toMatch(/too long/);
    const gap = ready({ conversation: { ...ready().conversation, knowledge: 'Price: [price]' } });
    expect(texts(gap)[0]).toMatch(/Knowledge: replace \[price\]/);
  });

  it('runs in English or Hinglish, and blocks Hindi', () => {
    expect(getReadiness(ready({ callSettings: { ...ready().callSettings, language: 'Hinglish' } })).blockers).toEqual([]);
    const p = ready({ callSettings: { ...ready().callSettings, language: 'Hindi' } });
    expect(texts(p)[0]).toMatch(/English or Hinglish/);
  });

  it('warns when nothing is ruled out', () => {
    const p = ready({ conversation: { ...ready().conversation, rules: { never: [], always: [] } } });
    expect(getReadiness(p).warnings[0]).toMatch(/Never/);
  });

  it('loads a saved conversation campaign, filling any missing settings', () => {
    const p = fromCampaign({ name: 'Saved', mode: 'conversation', conversation: { knowledge: 'K', endWhen: { acceptFirstNo: true } } });
    expect(p.mode).toBe('conversation');
    expect(p.conversation.knowledge).toBe('K');
    expect(p.conversation.endWhen).toEqual({ acceptFirstNo: true });
    expect(p.conversation.detailsToCollect).toEqual([]);
    expect(p.conversation.rules).toEqual({ never: [], always: [] });
    expect(fromCampaign({ name: 'Old' }).mode).toBe('questions');
  });

  it('counts words for the knowledge meter', () => {
    expect(wordCount('  one two\nthree ')).toBe(3);
    expect(wordCount('')).toBe(0);
  });
});

describe('testGreeting', () => {
  it('greets the test caller the way a live call does', () => {
    expect(testGreeting("Hi [Name], I'm calling from Acme")).toBe("Hi Alex, I'm calling from Acme. Am I speaking with Alex?");
    expect(testGreeting('Hi, is this Alex?')).toBe('Hi, is this Alex?');
    expect(testGreeting('')).toBe('Am I speaking with Alex?');
  });
});

describe('knowledgeWarning', () => {
  const shop = ['Divya Eyegrit Gold 20 N', 'Divya Eyegrit Gold 20 N', '12 g', '₹ 855.16 M.R.P.: ₹ 892.00 4.13% OFF', '5.0/5 (2)', 'Add to Cart',
    'Divya Neurogrit Gold 20 N', '13 g', '₹ 855.16 M.R.P.: ₹ 892.00', 'Add to Cart'].join('\n');

  it('flags a product listing pasted from a shop page', () => {
    expect(knowledgeWarning(shop)).toMatch(/copied from a shop page/);
    expect(getReadiness(ready({ conversation: { ...ready().conversation, knowledge: shop } })).warnings.join(' ')).toMatch(/what each item is for/);
  });

  it('leaves real descriptions alone, and short notes too', () => {
    const prose = Array.from({ length: 10 }, (_, i) => `Plan ${i} costs ₹999 per user per month and includes call reports for every campaign.`).join('\n');
    expect(knowledgeWarning(prose)).toBeNull();
    expect(knowledgeWarning('Price: ₹999')).toBeNull();
  });
});
