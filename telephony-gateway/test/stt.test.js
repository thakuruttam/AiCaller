import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupSTT } from '../src/providers/stt.js';

// Covers the barge-in debounce in the Sarvam STT provider: onSpeechStart
// (which triggers clearAudio on the live call, cutting the bot off) must
// only fire on loud, sustained speech — BARGE_IN_ENERGY_THRESHOLD (1400 RMS)
// for BARGE_IN_MIN_FRAMES (15 frames / 300ms). There's no acoustic echo
// cancellation on this pipeline, so the tail of the bot's own TTS leaking
// back into the mic (speakerphone, noisy line, imperfect handset isolation)
// reads as "speech" under a plain low threshold — that was clearing the
// bot's own audio mid-word (questions cut off by their last few letters, or
// occasionally skipped almost entirely when the false trigger landed right
// as the audio started). A genuine interruption from a phone mic is
// reliably louder and more sustained than that leaked echo.
//
// Uses encoding: 'pcm16' so tests can hand sendAudio() raw, controllable PCM16
// samples directly — no need to reverse-engineer mulaw byte encoding to hit a
// target RMS energy level.
//
// Uses language 'Hindi' to reach the Sarvam path: setupSTT() routes English
// calls to Deepgram regardless of SARVAM_API_KEY (see providers/stt.js) and
// only uses Sarvam for Hindi/Hinglish, so 'English' here would silently hit
// the Deepgram branch instead of the Sarvam code under test.

function frame(samples = 160, amplitude = 0) {
  const buf = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) buf.writeInt16LE(amplitude, i * 2);
  return buf;
}

// RMS ~2000 — clearly above BARGE_IN_ENERGY_THRESHOLD (1400): a genuine,
// close-mic interruption.
function loudFrame(samples = 160) {
  return frame(samples, 2000);
}

// RMS ~800 — above SPEECH_THRESHOLD (500) so it still counts as "speech" for
// transcript capture, but below BARGE_IN_ENERGY_THRESHOLD (1400): the leaked
// echo of the bot's own TTS, not a real interruption.
function echoFrame(samples = 160) {
  return frame(samples, 800);
}

function silentFrame(samples = 160) {
  return frame(samples, 0); // RMS 0
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
    return setupSTT('Hindi', {
      onTranscript: vi.fn(),
      onUtteranceEnd: vi.fn(),
      onSpeechStart,
      onError: vi.fn(),
    }, 'pcm16');
  }

  it('does not fire onSpeechStart for a single loud frame', () => {
    const onSpeechStart = vi.fn();
    const stt = makeStt(onSpeechStart);
    stt.sendAudio(loudFrame());
    expect(onSpeechStart).not.toHaveBeenCalled();
  });

  it('does not fire onSpeechStart for 14 sustained loud frames (just under BARGE_IN_MIN_FRAMES)', () => {
    const onSpeechStart = vi.fn();
    const stt = makeStt(onSpeechStart);
    for (let i = 0; i < 14; i++) stt.sendAudio(loudFrame());
    expect(onSpeechStart).not.toHaveBeenCalled();
  });

  it('fires onSpeechStart once loud speech is sustained for BARGE_IN_MIN_FRAMES (15 frames)', () => {
    const onSpeechStart = vi.fn();
    const stt = makeStt(onSpeechStart);
    for (let i = 0; i < 15; i++) stt.sendAudio(loudFrame());
    expect(onSpeechStart).toHaveBeenCalledTimes(1);
  });

  it('fires onSpeechStart only once per sustained utterance, not per frame', () => {
    const onSpeechStart = vi.fn();
    const stt = makeStt(onSpeechStart);
    for (let i = 0; i < 30; i++) stt.sendAudio(loudFrame());
    expect(onSpeechStart).toHaveBeenCalledTimes(1);
  });

  it('never fires onSpeechStart for echo-level energy, even sustained indefinitely', () => {
    const onSpeechStart = vi.fn();
    const stt = makeStt(onSpeechStart);
    for (let i = 0; i < 100; i++) stt.sendAudio(echoFrame());
    expect(onSpeechStart).not.toHaveBeenCalled();
  });

  it('resets the barge-in run if energy drops back to echo level before BARGE_IN_MIN_FRAMES', () => {
    const onSpeechStart = vi.fn();
    const stt = makeStt(onSpeechStart);
    for (let i = 0; i < 10; i++) stt.sendAudio(loudFrame());
    stt.sendAudio(echoFrame());
    for (let i = 0; i < 14; i++) stt.sendAudio(loudFrame());
    expect(onSpeechStart).not.toHaveBeenCalled();
  });

  it('fires again on a new utterance after a real silence gap resets state', () => {
    const onSpeechStart = vi.fn();
    const stt = makeStt(onSpeechStart);

    for (let i = 0; i < 15; i++) stt.sendAudio(loudFrame());
    expect(onSpeechStart).toHaveBeenCalledTimes(1);

    // 100 silent frames (SILENCE_FRAMES_TO_FLUSH) ends the utterance and resets state
    for (let i = 0; i < 100; i++) stt.sendAudio(silentFrame());

    for (let i = 0; i < 15; i++) stt.sendAudio(loudFrame());
    expect(onSpeechStart).toHaveBeenCalledTimes(2);
  });
});

// Covers two real-call bugs traced from production logs (a call that got
// "Are you still there?" interrupted mid-answer, then had one long answer
// split into two turns and the question repeated):
//
// 1. onSpeechActivity must fire on raw speech energy, independent of
//    whether a transcript has been produced yet — the no-answer timer uses
//    this to avoid interrupting a caller who is still mid-answer.
// 2. A final Sarvam segment must not be delivered immediately — it needs a
//    brief grace window so a same-breath continuation (a natural mid-
//    sentence pause) gets merged into one turn instead of firing
//    onUtteranceEnd twice for what was really one answer.
describe('Sarvam STT — no-answer activity signal and same-breath merge', () => {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  beforeEach(() => {
    process.env.SARVAM_API_KEY = 'test-key';
    process.env.SARVAM_MERGE_GRACE_MS = '80';
  });
  afterEach(() => {
    delete process.env.SARVAM_API_KEY;
    delete process.env.SARVAM_MERGE_GRACE_MS;
    vi.unstubAllGlobals();
  });

  it('fires onSpeechActivity on real speech energy before any transcript exists', () => {
    const onSpeechActivity = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ transcript: '' }) }));
    const stt = setupSTT('Hindi', {
      onTranscript: vi.fn(), onUtteranceEnd: vi.fn(), onSpeechStart: vi.fn(), onSpeechActivity, onError: vi.fn(),
    }, 'pcm16');

    stt.sendAudio(loudFrame());
    expect(onSpeechActivity).toHaveBeenCalled();
  });

  it('merges a same-breath continuation into one turn instead of repeating it as two', async () => {
    const onTranscript = vi.fn();
    const onUtteranceEnd = vi.fn();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ transcript: 'So I have not worked' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ transcript: 'on any of these.' }) });
    vi.stubGlobal('fetch', fetchMock);

    const stt = setupSTT('Hindi', {
      onTranscript, onUtteranceEnd, onSpeechStart: vi.fn(), onSpeechActivity: vi.fn(), onError: vi.fn(),
    }, 'pcm16');

    // First fragment of the answer, then a natural pause long enough to
    // trigger Sarvam's silence flush (SILENCE_FRAMES_TO_FLUSH = 100 frames).
    for (let i = 0; i < 15; i++) stt.sendAudio(loudFrame());
    for (let i = 0; i < 100; i++) stt.sendAudio(silentFrame());
    await wait(20); // let the mocked transcribe call resolve and arm the merge-grace timer

    // Caller resumes almost immediately with the rest of the same answer —
    // must cancel the pending delivery and merge instead of flushing twice.
    for (let i = 0; i < 15; i++) stt.sendAudio(loudFrame());
    for (let i = 0; i < 100; i++) stt.sendAudio(silentFrame());
    await wait(20);

    expect(onTranscript).not.toHaveBeenCalled(); // still held — grace window hasn't elapsed
    expect(onUtteranceEnd).not.toHaveBeenCalled();

    await wait(100); // past SARVAM_MERGE_GRACE_MS with no further speech

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onTranscript).toHaveBeenCalledTimes(1);
    expect(onTranscript).toHaveBeenCalledWith('So I have not worked on any of these.');
    expect(onUtteranceEnd).toHaveBeenCalledTimes(1);
  });

  it('delivers a single final segment after the grace window when the caller does not resume', async () => {
    const onTranscript = vi.fn();
    const onUtteranceEnd = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ transcript: 'Yes.' }) }));

    const stt = setupSTT('Hindi', {
      onTranscript, onUtteranceEnd, onSpeechStart: vi.fn(), onSpeechActivity: vi.fn(), onError: vi.fn(),
    }, 'pcm16');

    for (let i = 0; i < 15; i++) stt.sendAudio(loudFrame());
    for (let i = 0; i < 100; i++) stt.sendAudio(silentFrame());
    await wait(120); // past the mocked transcribe + SARVAM_MERGE_GRACE_MS

    expect(onTranscript).toHaveBeenCalledTimes(1);
    expect(onTranscript).toHaveBeenCalledWith('Yes.');
    expect(onUtteranceEnd).toHaveBeenCalledTimes(1);
  });
});
