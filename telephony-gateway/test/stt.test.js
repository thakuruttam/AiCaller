import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupSTT } from '../src/providers/stt.js';

// Covers the barge-in debounce fix in the Sarvam STT provider: onSpeechStart
// (which triggers clearAudio on the live call) previously fired on the very
// first 20ms frame above the energy threshold — a single noise blip or cough
// was enough to cut off the bot's audio mid-sentence. It should now only fire
// once speech has been sustained for MIN_SPEECH_FRAMES (5 frames / 100ms).
//
// Uses encoding: 'pcm16' so tests can hand sendAudio() raw, controllable PCM16
// samples directly — no need to reverse-engineer mulaw byte encoding to hit a
// target RMS energy level.

function loudFrame(samples = 160, amplitude = 2000) {
  const buf = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) buf.writeInt16LE(amplitude, i * 2);
  return buf; // RMS ~2000, well above the 500 SPEECH_THRESHOLD
}

function silentFrame(samples = 160) {
  return Buffer.alloc(samples * 2); // all zeros — RMS 0
}

describe('Sarvam STT — barge-in debounce', () => {
  beforeEach(() => {
    process.env.SARVAM_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ transcript: '' }),
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SARVAM_API_KEY;
  });

  function makeStt(onSpeechStart) {
    return setupSTT('English', {
      onTranscript: vi.fn(),
      onUtteranceEnd: vi.fn(),
      onSpeechStart,
      onError: vi.fn(),
    }, 'pcm16');
  }

  it('does not fire onSpeechStart for a single-frame noise blip', () => {
    const onSpeechStart = vi.fn();
    const stt = makeStt(onSpeechStart);
    stt.sendAudio(loudFrame());
    expect(onSpeechStart).not.toHaveBeenCalled();
  });

  it('does not fire onSpeechStart for 4 sustained frames (just under the threshold)', () => {
    const onSpeechStart = vi.fn();
    const stt = makeStt(onSpeechStart);
    for (let i = 0; i < 4; i++) stt.sendAudio(loudFrame());
    expect(onSpeechStart).not.toHaveBeenCalled();
  });

  it('fires onSpeechStart once speech is sustained for MIN_SPEECH_FRAMES (5 frames)', () => {
    const onSpeechStart = vi.fn();
    const stt = makeStt(onSpeechStart);
    for (let i = 0; i < 5; i++) stt.sendAudio(loudFrame());
    expect(onSpeechStart).toHaveBeenCalledTimes(1);
  });

  it('fires onSpeechStart only once per sustained utterance, not per frame', () => {
    const onSpeechStart = vi.fn();
    const stt = makeStt(onSpeechStart);
    for (let i = 0; i < 15; i++) stt.sendAudio(loudFrame());
    expect(onSpeechStart).toHaveBeenCalledTimes(1);
  });

  it('fires again on a new utterance after a real silence gap resets state', () => {
    const onSpeechStart = vi.fn();
    const stt = makeStt(onSpeechStart);

    for (let i = 0; i < 5; i++) stt.sendAudio(loudFrame());
    expect(onSpeechStart).toHaveBeenCalledTimes(1);

    // 90 silent frames (SILENCE_FRAMES_TO_FLUSH) ends the utterance and resets state
    for (let i = 0; i < 90; i++) stt.sendAudio(silentFrame());

    for (let i = 0; i < 5; i++) stt.sendAudio(loudFrame());
    expect(onSpeechStart).toHaveBeenCalledTimes(2);
  });
});
