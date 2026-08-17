import { describe, it, expect, vi } from 'vitest';
import { speakBackToPlivo } from '../src/providers/tts.js';

// Covers the TTS caching wrapper added on top of speakBackToPlivo: scripted
// (cacheable) English text should synthesize once, cache the resulting audio
// in Redis, and replay it directly on a cache hit — skipping the TTS provider
// entirely. Uses a fake ttsSocket instead of a real Deepgram WebSocket so
// these tests don't touch the network.

function fakeWs() {
  return { send: vi.fn() };
}

function fakeRedis() {
  const store = new Map();
  return {
    get: vi.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    setex: vi.fn(async (key, _ttl, value) => { store.set(key, value); }),
  };
}

function fakeTtsSocket(chunks = ['chunk-a', 'chunk-b']) {
  return {
    speak: vi.fn(async (text, onAudio) => {
      for (const c of chunks) onAudio(Buffer.from(c));
    }),
  };
}

describe('speakBackToPlivo — TTS cache', () => {
  it('synthesizes on a cache miss, then writes the audio to the cache', async () => {
    const ws = fakeWs();
    const redis = fakeRedis();
    const ttsSocket = fakeTtsSocket();

    const ok = await speakBackToPlivo(ws, 'stream1', 'What is your role?', 'English', ttsSocket, {
      redis, campaignId: 'camp1', cacheable: true,
    });

    expect(ok).toBe(true);
    expect(ttsSocket.speak).toHaveBeenCalledTimes(1);

    // playAudio events for both chunks + a final checkpoint
    const events = ws.send.mock.calls.map(([msg]) => JSON.parse(msg));
    expect(events.filter(e => e.event === 'playAudio')).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({ event: 'checkpoint', name: 'end_of_tts' });

    // Cache write happens asynchronously (fire-and-forget) — flush microtasks
    await new Promise(r => setImmediate(r));
    expect(redis.setex).toHaveBeenCalledTimes(1);
    const [key, ttl, value] = redis.setex.mock.calls[0];
    expect(key).toMatch(/^ttscache:camp1:English:/);
    expect(ttl).toBeGreaterThan(0);
    expect(JSON.parse(value)).toHaveLength(2);
  });

  it('replays cached audio on a hit without touching the TTS provider', async () => {
    const redis = fakeRedis();
    const ttsSocket = fakeTtsSocket();
    const text = 'What is your budget?';

    // Prime the cache with a first call
    await speakBackToPlivo(fakeWs(), 'stream1', text, 'English', ttsSocket, {
      redis, campaignId: 'camp1', cacheable: true,
    });
    await new Promise(r => setImmediate(r));
    expect(redis.setex).toHaveBeenCalledTimes(1);

    // Second call, same text — should hit cache
    const ws2 = fakeWs();
    const ok = await speakBackToPlivo(ws2, 'stream2', text, 'English', ttsSocket, {
      redis, campaignId: 'camp1', cacheable: true,
    });

    expect(ok).toBe(true);
    expect(ttsSocket.speak).toHaveBeenCalledTimes(1); // still just the priming call — no new synthesis
    const events = ws2.send.mock.calls.map(([msg]) => JSON.parse(msg));
    expect(events.filter(e => e.event === 'playAudio')).toHaveLength(2);
    expect(events.at(-1)).toMatchObject({ event: 'checkpoint', name: 'end_of_tts' });
  });

  it('never touches the cache when cacheable is false (real LLM replies)', async () => {
    const ws = fakeWs();
    const redis = fakeRedis();
    const ttsSocket = fakeTtsSocket();

    await speakBackToPlivo(ws, 'stream1', 'A free-form LLM reply.', 'English', ttsSocket, {
      redis, campaignId: 'camp1', cacheable: false,
    });
    await new Promise(r => setImmediate(r));

    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
    expect(ttsSocket.speak).toHaveBeenCalledTimes(1); // still synthesized, just not cached
  });

  it('never touches the cache without cacheOpts (existing call sites keep working)', async () => {
    const ws = fakeWs();
    const ttsSocket = fakeTtsSocket();

    const ok = await speakBackToPlivo(ws, 'stream1', 'Hello.', 'English', ttsSocket);

    expect(ok).toBe(true);
    expect(ttsSocket.speak).toHaveBeenCalledTimes(1);
  });

  it('skips caching for non-English even when cacheable is true', async () => {
    const redis = fakeRedis();

    await speakBackToPlivo(fakeWs(), 'stream1', 'नमस्ते', 'Hindi', null, {
      redis, campaignId: 'camp1', cacheable: true,
    });

    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.setex).not.toHaveBeenCalled();
  });

  it('keys the cache separately per campaign for identical text', async () => {
    const redis = fakeRedis();
    const text = 'Are you the account holder?';

    await speakBackToPlivo(fakeWs(), 's1', text, 'English', fakeTtsSocket(), { redis, campaignId: 'campA', cacheable: true });
    await new Promise(r => setImmediate(r));
    await speakBackToPlivo(fakeWs(), 's2', text, 'English', fakeTtsSocket(), { redis, campaignId: 'campB', cacheable: true });
    await new Promise(r => setImmediate(r));

    expect(redis.setex).toHaveBeenCalledTimes(2);
    const [keyA] = redis.setex.mock.calls[0];
    const [keyB] = redis.setex.mock.calls[1];
    expect(keyA).not.toBe(keyB);
  });
});
