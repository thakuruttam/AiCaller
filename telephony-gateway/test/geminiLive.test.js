import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Same FakeWebSocket approach as openaiRealtime.test.js: tests drive the
// Gemini Live connection directly and inspect exactly what was sent.
class FakeWebSocket extends EventEmitter {
  constructor(url, opts) {
    super();
    FakeWebSocket.instances.push(this);
    this.url = url;
    this.opts = opts;
    this.sent = [];
    this.readyState = 0;
    this.OPEN = 1;
  }
  send(data) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; this.emit('close'); }
  _open() { this.readyState = 1; this.emit('open'); }
  _message(obj) { this.emit('message', Buffer.from(JSON.stringify(obj))); }
}
FakeWebSocket.instances = [];
FakeWebSocket.OPEN = 1;

vi.mock('ws', () => ({ WebSocket: FakeWebSocket }));

const { setupGeminiLive } = await import('../src/providers/geminiLive.js');

// 24 kHz 16-bit PCM silence — enough samples to survive the 24k→8k resample.
const AUDIO = Buffer.alloc(48).toString('base64');
const audioMsg = () => ({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: AUDIO } }] } } });
const speakTexts = (socket) => socket.sent
  .filter(m => m.clientContent)
  .map(m => m.clientContent.turns[0].parts[0].text);

describe('Gemini Live provider — forcing a line over the model', () => {
  let handlers, session, socket;

  beforeEach(() => {
    FakeWebSocket.instances.length = 0;
    process.env.GEMINI_API_KEY = 'test-key';
    handlers = {
      onTranscript: vi.fn(), onAudio: vi.fn(), onSpeechStart: vi.fn(), onSpeechActivity: vi.fn(),
      onResponseDone: vi.fn(), onError: vi.fn(), onClose: vi.fn(), onToolCall: vi.fn(),
      onAssistantTranscript: vi.fn(), onReady: vi.fn(), onClearPlayback: vi.fn()
    };
    session = setupGeminiLive('x', handlers);
    socket = FakeWebSocket.instances[0];
    socket._open();
    socket._message({ setupComplete: {} });
    socket.sent.length = 0;
  });
  afterEach(() => { delete process.env.GEMINI_API_KEY; });

  it('mutes a reply the model started on its own and plays the forced line only after it ends', () => {
    // The model replies to the caller on its own (no speak() from us) — the
    // 2026-11-05 live-call case: "We won't be moving forward with your..."
    socket._message(audioMsg());
    expect(handlers.onAudio).toHaveBeenCalledTimes(1);

    session.interruptAndSpeak('thank you for your time');
    expect(handlers.onClearPlayback).toHaveBeenCalledTimes(1);
    // Not sent mid-response — queued behind the muted turn.
    expect(speakTexts(socket)).toHaveLength(0);

    socket._message(audioMsg()); // rest of the model's own line
    expect(handlers.onAudio).toHaveBeenCalledTimes(1); // dropped, never reaches the caller

    socket._message({ serverContent: { turnComplete: true } });
    expect(speakTexts(socket)).toHaveLength(1);
    expect(speakTexts(socket)[0]).toContain('thank you for your time');
    // The muted turn must not count as a normal finished response.
    expect(handlers.onResponseDone).not.toHaveBeenCalled();

    socket._message(audioMsg()); // the forced line's own audio plays normally
    expect(handlers.onAudio).toHaveBeenCalledTimes(2);
  });

  it('treats a tool call as the start of a model turn, so a forced line right after it is still queued', () => {
    socket._message({ toolCall: { functionCalls: [{ id: 'c1', name: 'end_call', args: { reason: 'declined' } }] } });
    session.interruptAndSpeak('thank you for your time');
    expect(speakTexts(socket)).toHaveLength(0);
    socket._message({ serverContent: { turnComplete: true } });
    expect(speakTexts(socket)[0]).toContain('thank you for your time');
  });

  it('speaks immediately when nothing is in flight', () => {
    session.interruptAndSpeak('thank you for your time');
    expect(handlers.onClearPlayback).not.toHaveBeenCalled();
    expect(speakTexts(socket)).toHaveLength(1);
  });

  it('muteInFlight drops the rest of the current reply without queueing anything', () => {
    socket._message(audioMsg());
    session.muteInFlight();
    expect(handlers.onClearPlayback).toHaveBeenCalledTimes(1);
    socket._message(audioMsg());
    expect(handlers.onAudio).toHaveBeenCalledTimes(1);
    socket._message({ serverContent: { turnComplete: true } });
    expect(speakTexts(socket)).toHaveLength(0);
  });

  it('muteInFlight is a no-op when the model is silent', () => {
    session.muteInFlight();
    expect(handlers.onClearPlayback).not.toHaveBeenCalled();
    socket._message(audioMsg());
    expect(handlers.onAudio).toHaveBeenCalledTimes(1);
  });
});
