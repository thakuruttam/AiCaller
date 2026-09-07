import { describe, it, expect } from 'vitest';
import { VoiceAgent } from '../src/VoiceAgent.js';

// Covers a real production bug: evalCondition('contains', ...) treated a
// comma-separated "expected answer" value (e.g. "manual, automation,
// performance, security, API" — a list of acceptable alternatives a
// campaign creator configured in the wizard) as one literal joined phrase.
// A caller answering "API." could never satisfy that check, since "API."
// obviously never contains the entire string "manual, automation,
// performance, security, API" — the mandatory-question retry then fired on
// every genuinely correct single-keyword answer. Fixed to split on commas
// and match ANY item (OR semantics), which is what a comma list means in
// this UI (frontend/src/pages/CampaignWizard/components/Step3DataToCollect.jsx).
function makeAgent() {
  return new VoiceAgent({ dataToCollect: [] });
}

describe('VoiceAgent.evalCondition — comma-separated contains/does not contain', () => {
  const value = 'manual, automation, performance, security, API';

  it('matches a single listed keyword, not the whole joined phrase', () => {
    const agent = makeAgent();
    expect(agent.evalCondition('contains', value, 'API.')).toBe(true);
  });

  it('matches any one of several listed keywords appearing in a full sentence', () => {
    const agent = makeAgent();
    expect(agent.evalCondition('contains', value, "I've mostly done manual testing.")).toBe(true);
  });

  it('does not match an answer containing none of the listed keywords', () => {
    const agent = makeAgent();
    expect(agent.evalCondition('contains', value, 'tech stack, and I work with my team lead')).toBe(false);
  });

  it('still works for a single-value (no comma) contains condition, unchanged', () => {
    const agent = makeAgent();
    expect(agent.evalCondition('contains', 'market research', 'Yes, market research mostly.')).toBe(true);
    expect(agent.evalCondition('contains', 'market research', 'Banking and e-commerce.')).toBe(false);
  });

  it('"does not contain" fails (returns false) if ANY listed item is present', () => {
    const agent = makeAgent();
    expect(agent.evalCondition('does not contain', 'spam, robot, scam', 'This sounds like a scam.')).toBe(false);
  });

  it('"does not contain" passes (returns true) only when NONE of the listed items are present', () => {
    const agent = makeAgent();
    expect(agent.evalCondition('does not contain', 'spam, robot, scam', 'A totally normal answer.')).toBe(true);
  });

  it('tolerates Deepgram smart_format punctuation noise around a listed item', () => {
    const agent = makeAgent();
    expect(agent.evalCondition('contains', value, 'Mostly API. and performance.')).toBe(true);
  });
});
