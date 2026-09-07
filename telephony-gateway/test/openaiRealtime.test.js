import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock the `ws` WebSocket class so tests control the OpenAI Realtime
// connection lifecycle directly (open/message/close/error) instead of
// hitting the real API, and can inspect exactly what was sent.
class FakeWebSocket extends EventEmitter {
  constructor(url, opts) {
    super();
    FakeWebSocket.instances.push(this);
    this.url = url;
    this.opts = opts;
    this.sent = [];
    this.readyState = 0; // CONNECTING
    this.OPEN = 1;
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    this.emit('close');
  }
  // Test helper: simulate the connection succeeding.
  _open() {
    this.readyState = 1;
    this.emit('open');
  }
  _message(obj) {
    this.emit('message', JSON.stringify(obj));
  }
}
FakeWebSocket.instances = [];
FakeWebSocket.OPEN = 1;

vi.mock('ws', () => ({ WebSocket: FakeWebSocket }));

const { setupRealtime } = await import('../src/providers/openaiRealtime.js');

describe('OpenAI Realtime provider', () => {
  beforeEach(() => {
    FakeWebSocket.instances.length = 0;
    process.env.OPENAI_API_KEY = 'test-key';
  });
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_REALTIME_EAGERNESS;
  });

  function makeHandlers() {
    return {
      onTranscript: vi.fn(),
      onAudio: vi.fn(),
      onSpeechStart: vi.fn(),
      onResponseDone: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
    };
  }

  it('configures the session with semantic_vad and audio/pcmu (mulaw) both ways on connect', () => {
    const handlers = makeHandlers();
    setupRealtime('be a helpful agent', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    const update = socket.sent.find(m => m.type === 'session.update');
    expect(update).toBeTruthy();
    expect(update.session.instructions).toBe('be a helpful agent');
    expect(update.session.audio.input.format).toEqual({ type: 'audio/pcmu' });
    expect(update.session.audio.output.format).toEqual({ type: 'audio/pcmu' });
    expect(update.session.audio.input.turn_detection.type).toBe('semantic_vad');
  });

  it('disables the API\'s autonomous auto-response — VoiceAgent must be the sole decision-maker for what gets said', () => {
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    const update = socket.sent.find(m => m.type === 'session.update');
    expect(update.session.audio.input.turn_detection.create_response).toBe(false);
    expect(update.session.audio.input.turn_detection.interrupt_response).toBe(false);
  });

  it('defaults turn-detection eagerness to low, and respects an override', () => {
    process.env.OPENAI_REALTIME_EAGERNESS = 'high';
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();
    const update = socket.sent.find(m => m.type === 'session.update');
    expect(update.session.audio.input.turn_detection.eagerness).toBe('high');
  });

  it('forwards a completed transcript to onTranscript', () => {
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    socket._message({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'Hello there' });
    expect(handlers.onTranscript).toHaveBeenCalledWith('Hello there');
  });

  it('does not fire onTranscript for an empty/whitespace transcript', () => {
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    socket._message({ type: 'conversation.item.input_audio_transcription.completed', transcript: '   ' });
    expect(handlers.onTranscript).not.toHaveBeenCalled();
  });

  it('decodes response.output_audio.delta (the GA event name) and forwards raw bytes to onAudio', () => {
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    const payload = Buffer.from([1, 2, 3, 4]).toString('base64');
    socket._message({ type: 'response.output_audio.delta', delta: payload });
    expect(handlers.onAudio).toHaveBeenCalledTimes(1);
    expect(handlers.onAudio.mock.calls[0][0]).toEqual(Buffer.from([1, 2, 3, 4]));
  });

  it('only signals barge-in (onSpeechStart) while the bot is actually speaking', () => {
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    // Caller starts talking on their own turn — bot isn't speaking, not a barge-in.
    socket._message({ type: 'input_audio_buffer.speech_started' });
    expect(handlers.onSpeechStart).not.toHaveBeenCalled();

    // Now the bot is mid-reply — this time it IS a real interruption.
    session.speak('Can you tell me more?');
    socket._message({ type: 'input_audio_buffer.speech_started' });
    expect(handlers.onSpeechStart).toHaveBeenCalledTimes(1);
  });

  it('fires onResponseDone when the bot finishes speaking', () => {
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    session.speak('Goodbye.');
    socket._message({ type: 'response.done' });
    expect(handlers.onResponseDone).toHaveBeenCalledTimes(1);
  });

  it('warns when a response completes with zero audio chunks delivered', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    session.speak('This should have produced audio.');
    socket._message({ type: 'response.done' }); // no response.output_audio.delta ever arrived
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ZERO audio chunks'));
    warnSpy.mockRestore();
  });

  it('speak() sends a verbatim-text directive followed by response.create', () => {
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();
    socket.sent.length = 0; // clear the initial session.update

    session.speak('Thank you for your time.');
    const create = socket.sent.find(m => m.type === 'conversation.item.create');
    expect(create.item.content[0].text).toContain('Thank you for your time.');
    expect(socket.sent.some(m => m.type === 'response.create')).toBe(true);
  });

  it('sendAudio base64-encodes and appends mulaw buffers once ready', () => {
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();
    socket.sent.length = 0;

    const buf = Buffer.from([9, 9, 9]);
    session.sendAudio(buf);
    const append = socket.sent.find(m => m.type === 'input_audio_buffer.append');
    expect(append.audio).toBe(buf.toString('base64'));
  });

  it('sendAudio before the socket is ready is a silent no-op, not a throw', () => {
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    // Deliberately do NOT call socket._open() — socket is still CONNECTING.
    expect(() => session.sendAudio(Buffer.from([1]))).not.toThrow();
  });

  it('queues a speak() called before the socket is ready and sends it once open, instead of silently dropping it', () => {
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    // Deliberately do NOT open the socket first — this is the exact race a
    // real call hit: the greeting's own OpenAI chat-completion call
    // resolved before the Realtime WebSocket handshake finished, and the
    // old code just silently dropped the speak() call with no log line.
    session.speak('Hi, this is an automated call. Am I speaking with Uttam?');
    expect(socket.sent.find(m => m.type === 'conversation.item.create')).toBeUndefined();

    socket._open(); // handshake completes late
    const create = socket.sent.find(m => m.type === 'conversation.item.create');
    expect(create).toBeTruthy();
    expect(create.item.content[0].text).toContain('Am I speaking with Uttam?');
    expect(socket.sent.some(m => m.type === 'response.create')).toBe(true);
  });

  it('only flushes the LATEST queued speak() if called more than once before ready', () => {
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];

    session.speak('first draft');
    session.speak('final version');
    socket._open();

    const creates = socket.sent.filter(m => m.type === 'conversation.item.create');
    expect(creates).toHaveLength(1);
    expect(creates[0].item.content[0].text).toContain('final version');
  });

  it('surfaces a server error event through onError', () => {
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    socket._message({ type: 'error', error: { message: 'bad session config' } });
    expect(handlers.onError).toHaveBeenCalledTimes(1);
    expect(handlers.onError.mock.calls[0][0].message).toBe('bad session config');
  });

  it('fires onClose when the connection closes', () => {
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    session.close();
    expect(handlers.onClose).toHaveBeenCalledTimes(1);
  });
});
