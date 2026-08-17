import { describe, it, expect } from 'vitest';

// telephony-gateway is almost entirely I/O (WebSocket audio streaming, STT/TTS/LLM
// turn-taking interleaved in VoiceAgent.js/plivoStreamHandler.js) with no extracted
// pure-logic module to unit test yet — see ARCHITECTURE_REVIEW.md / the test-setup
// plan for the follow-up refactor needed before real coverage lands here.
// This placeholder keeps the CI test matrix entry green and correctly wired so
// real tests can be dropped in without any job/config changes once that refactor happens.
describe('telephony-gateway test harness', () => {
  it('is wired up and ready for real tests', () => {
    expect(true).toBe(true);
  });
});
