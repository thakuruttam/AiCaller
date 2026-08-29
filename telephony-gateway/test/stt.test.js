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
    return setupSTT('English', {
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

    // 90 silent frames (SILENCE_FRAMES_TO_FLUSH) ends the utterance and resets state
    for (let i = 0; i < 90; i++) stt.sendAudio(silentFrame());

    for (let i = 0; i < 15; i++) stt.sendAudio(loudFrame());
    expect(onSpeechStart).toHaveBeenCalledTimes(2);
  });
});
