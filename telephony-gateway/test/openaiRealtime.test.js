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
      onSpeechActivity: vi.fn(),
      onResponseDone: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
      onToolCall: vi.fn(),
      onAssistantTranscript: vi.fn(),
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

  it('explicitly enables input audio transcription — a real call showed this is opt-in, not automatic', () => {
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    const update = socket.sent.find(m => m.type === 'session.update');
    expect(update.session.audio.input.transcription).toBeTruthy();
    expect(update.session.audio.input.transcription.model).toBe('gpt-4o-transcribe');
  });

  it('defaults transcription language to English, and respects an explicit override', () => {
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    let socket = FakeWebSocket.instances[0];
    socket._open();
    let update = socket.sent.find(m => m.type === 'session.update');
    expect(update.session.audio.input.transcription.language).toBe('en');

    setupRealtime('x', makeHandlers(), 'hi');
    socket = FakeWebSocket.instances[1];
    socket._open();
    update = socket.sent.find(m => m.type === 'session.update');
    expect(update.session.audio.input.transcription.language).toBe('hi');
  });

  it('cancels the in-flight response on barge-in, not just clearing Plivo\'s local buffer', () => {
    // clearAudio (handled by the caller of onSpeechStart, in
    // plivoStreamHandler.js) only stops Plivo from PLAYING what's already
    // been sent — a live call showed the model continuing to generate and
    // stream MORE audio for the same stale response afterward, which then
    // got queued right back into Plivo's buffer and interrupted the caller
    // a second time. An explicit response.cancel stops the source, not
    // just the symptom.
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();
    socket.sent.length = 0;

    session.speak('This is a long reply the bot is mid-way through saying.');
    socket._message({ type: 'input_audio_buffer.speech_started' }); // barge-in
    expect(socket.sent.some(m => m.type === 'response.cancel')).toBe(true);
    expect(handlers.onSpeechStart).toHaveBeenCalledTimes(1);
  });

  // Confirmed on a live call: response.cancel does not stop audio already in
  // flight for the response it cancels — the log showed "Response finished —
  // 21 audio chunks delivered" for the exact response a barge-in had just
  // cancelled, and (before this fix) that audio was forwarded to Plivo same
  // as any other, landing on top of whatever played next. The caller heard
  // this as the bot suddenly talking gibberish.
  it('drops audio chunks that arrive for a response after it was cancelled by a barge-in', () => {
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    session.speak('This is a long reply the bot is mid-way through saying.');
    socket._message({ type: 'input_audio_buffer.speech_started' }); // barge-in -> response.cancel sent

    // The server had already generated more audio for the cancelled response
    // before honoring the cancel — this must NOT reach Plivo.
    socket._message({ type: 'response.output_audio.delta', delta: Buffer.from('stale').toString('base64') });
    expect(handlers.onAudio).not.toHaveBeenCalled();
  });

  it('resumes forwarding audio normally once the cancelled response\'s own response.done arrives', () => {
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    session.speak('First reply.');
    socket._message({ type: 'input_audio_buffer.speech_started' }); // barge-in -> cancel
    socket._message({ type: 'response.output_audio.delta', delta: Buffer.from('stale').toString('base64') }); // dropped
    socket._message({ type: 'response.done' }); // the cancelled response's own done

    session.speak('Second, real reply.');
    socket._message({ type: 'response.output_audio.delta', delta: Buffer.from('real').toString('base64') });
    expect(handlers.onAudio).toHaveBeenCalledTimes(1);
    expect(handlers.onAudio).toHaveBeenCalledWith(Buffer.from('real'));
  });

  it('does not get stuck dropping audio forever if the cancel itself is rejected (response_cancel_not_active)', () => {
    // Confirmed on the same live call: a later cancel raced with a response
    // that had already finished, and the API rejected it with
    // response_cancel_not_active — no response.done is ever coming for a
    // "cancelled" response that never existed, so without recovering here
    // the drop-audio guard would stay on for the rest of the call, silently
    // swallowing even the eventual sign-off.
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    session.speak('First reply.');
    socket._message({ type: 'input_audio_buffer.speech_started' }); // barge-in -> cancel sent
    socket._message({ type: 'error', error: { code: 'response_cancel_not_active', message: 'Cancellation failed: no active response found' } });

    session.speak('Sign-off.');
    socket._message({ type: 'response.output_audio.delta', delta: Buffer.from('signoff').toString('base64') });
    expect(handlers.onAudio).toHaveBeenCalledWith(Buffer.from('signoff'));
  });

  it('defaults turn-detection eagerness to medium, and respects an override', () => {
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();
    const update = socket.sent.find(m => m.type === 'session.update');
    expect(update.session.audio.input.turn_detection.eagerness).toBe('medium');
  });

  it('respects an eagerness override', () => {
    process.env.OPENAI_REALTIME_EAGERNESS = 'low';
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();
    const update = socket.sent.find(m => m.type === 'session.update');
    expect(update.session.audio.input.turn_detection.eagerness).toBe('low');
  });

  it('defaults voice to alloy, and a per-campaign voiceOverride argument takes priority over the env default', () => {
    process.env.OPENAI_REALTIME_VOICE = 'echo';
    const handlers = makeHandlers();
    setupRealtime('x', handlers, 'en', 'marin');
    const socket = FakeWebSocket.instances[0];
    socket._open();
    const update = socket.sent.find(m => m.type === 'session.update');
    expect(update.session.audio.output.voice).toBe('marin');
    delete process.env.OPENAI_REALTIME_VOICE;
  });

  it('falls back to the env var, then alloy, when no voiceOverride is passed', () => {
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();
    const update = socket.sent.find(m => m.type === 'session.update');
    expect(update.session.audio.output.voice).toBe('alloy');
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

  // Confirmed on a live call: the caller insisted they said nothing at all
  // at three points in the call where the transcript nonetheless showed them
  // saying a short plausible filler word ("Sure," "Okay.", "Yes") — a
  // documented hallucination pattern for these transcription models on
  // near-silent/ambiguous audio (this file already has one prior hallucination
  // incident on record: mis-transcribing English as Arabic/Hindi/Urdu script).
  it('drops a transcript whose underlying speech segment was too short to be real speech (hallucination guard)', () => {
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    socket._message({ type: 'input_audio_buffer.speech_started', audio_start_ms: 1000 });
    socket._message({ type: 'input_audio_buffer.speech_stopped', audio_end_ms: 1120 }); // 120ms — too short to be a real word
    socket._message({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'Sure,' });

    expect(handlers.onTranscript).not.toHaveBeenCalled();
  });

  it('still forwards a transcript whose speech segment was a plausible real-speech duration', () => {
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    socket._message({ type: 'input_audio_buffer.speech_started', audio_start_ms: 1000 });
    socket._message({ type: 'input_audio_buffer.speech_stopped', audio_end_ms: 2500 }); // 1.5s — plausible real speech
    socket._message({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'Yes, this is Karan' });

    expect(handlers.onTranscript).toHaveBeenCalledWith('Yes, this is Karan');
  });

  it('does not filter a transcript when speech-segment duration is unknown (no speech_started/stopped seen)', () => {
    // Guards against the hallucination filter itself ever silently eating a
    // real answer just because this test harness (or some future event-order
    // edge case) didn't emit the VAD boundary events first.
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    socket._message({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'Yes' });
    expect(handlers.onTranscript).toHaveBeenCalledWith('Yes');
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

  it('fires onSpeechActivity on ANY speech start, unlike onSpeechStart which is barge-in-only', () => {
    // A real call hung up exactly 60s in regardless of active conversation
    // because nothing on this path ever reset the call-level silence
    // timer — onSpeechActivity exists specifically to drive that reset.
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    // Bot isn't speaking — this is just the normal start of the caller's
    // own turn, not a barge-in, but it's still real activity.
    socket._message({ type: 'input_audio_buffer.speech_started' });
    expect(handlers.onSpeechStart).not.toHaveBeenCalled();
    expect(handlers.onSpeechActivity).toHaveBeenCalledTimes(1);
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

  it('queues a speak() called while a previous response is still in flight, and flushes it on response.done', () => {
    // Real live-call bug: removing the per-turn merge-grace buffer let two
    // turns dispatch close enough together that the second speak() fired
    // response.create while the first response was still generating — the
    // API rejected it outright ("conversation_already_has_active_response")
    // and that turn's reply was never spoken at all.
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();
    socket.sent.length = 0;

    session.speak('First reply.');
    expect(socket.sent.filter(m => m.type === 'response.create')).toHaveLength(1);

    session.speak('Second reply, arrived while the first is still generating.');
    // Must NOT have sent a second response.create yet — it should be queued.
    expect(socket.sent.filter(m => m.type === 'response.create')).toHaveLength(1);
    expect(socket.sent.filter(m => m.type === 'conversation.item.create')).toHaveLength(1);

    socket._message({ type: 'response.done', response: {} });

    const creates = socket.sent.filter(m => m.type === 'conversation.item.create');
    expect(creates).toHaveLength(2);
    expect(creates[1].item.content[0].text).toContain('Second reply');
    expect(socket.sent.filter(m => m.type === 'response.create')).toHaveLength(2);
  });

  it('recovers from a rejected response.create instead of permanently wedging the call silent', () => {
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();
    socket.sent.length = 0;

    session.speak('First reply.');
    // Simulate the API rejecting a conflicting response.create that our own
    // code should no longer be able to trigger (speak() now guards against
    // it) — but recovering here is a cheap backstop against any other path
    // that could hit this and leave botSpeaking stuck true forever.
    socket._message({
      type: 'error',
      error: { code: 'conversation_already_has_active_response', message: 'Conversation already has an active response in progress.' }
    });

    session.speak('Next turn should still be speakable.');
    const creates = socket.sent.filter(m => m.type === 'conversation.item.create');
    expect(creates.some(c => c.item.content[0].text.includes('Next turn should still be speakable'))).toBe(true);
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

describe('OpenAI Realtime provider — autonomous (free-flowing, tool-calling) mode', () => {
  beforeEach(() => {
    FakeWebSocket.instances.length = 0;
    process.env.OPENAI_API_KEY = 'test-key';
  });
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  function makeHandlers() {
    return {
      onTranscript: vi.fn(),
      onAudio: vi.fn(),
      onSpeechStart: vi.fn(),
      onSpeechActivity: vi.fn(),
      onResponseDone: vi.fn(),
      onError: vi.fn(),
      onClose: vi.fn(),
      onToolCall: vi.fn(),
      onAssistantTranscript: vi.fn(),
    };
  }

  it('beginAutonomousConversation sends a session.update with create_response:true and the tool list', () => {
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();
    socket.sent.length = 0;

    const tools = [{ type: 'function', name: 'end_call', parameters: {} }];
    session.beginAutonomousConversation('new instructions', tools);

    const update = socket.sent.find(m => m.type === 'session.update');
    expect(update).toBeTruthy();
    expect(update.session.instructions).toBe('new instructions');
    expect(update.session.tools).toEqual(tools);
    expect(update.session.audio.input.turn_detection.create_response).toBe(true);
  });

  it('is a no-op if called before the socket is ready', () => {
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    // Deliberately not opened.
    session.beginAutonomousConversation('instructions', []);
    expect(socket.sent.find(m => m.type === 'session.update')).toBeUndefined();
  });

  it('forwards a tool call to onToolCall with parsed arguments, and acknowledges it', () => {
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();
    socket.sent.length = 0;

    socket._message({
      type: 'response.function_call_arguments.done',
      name: 'answer_captured',
      arguments: JSON.stringify({ question_id: 'q1' }),
      call_id: 'call_123'
    });

    expect(handlers.onToolCall).toHaveBeenCalledWith('answer_captured', { question_id: 'q1' });
    const ack = socket.sent.find(m => m.type === 'conversation.item.create' && m.item?.type === 'function_call_output');
    expect(ack).toBeTruthy();
    expect(ack.item.call_id).toBe('call_123');
  });

  it('forwards the model\'s own spoken text to onAssistantTranscript', () => {
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    socket._message({ type: 'response.output_audio_transcript.done', transcript: 'Sure, tell me more about that.' });
    expect(handlers.onAssistantTranscript).toHaveBeenCalledWith('Sure, tell me more about that.');
  });

  it('interruptAndSpeak cancels an in-flight response before forcing the new text', () => {
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();
    socket.sent.length = 0;

    session.speak('model was mid-response');
    expect(socket.sent.filter(m => m.type === 'response.create')).toHaveLength(1);

    session.interruptAndSpeak('Thank you for your time. Goodbye.');
    expect(socket.sent.some(m => m.type === 'response.cancel')).toBe(true);
    const creates = socket.sent.filter(m => m.type === 'conversation.item.create');
    expect(creates[creates.length - 1].item.content[0].text).toContain('Thank you for your time. Goodbye.');
    // Must not have queued behind the cancelled response — sent immediately.
    expect(socket.sent.filter(m => m.type === 'response.create')).toHaveLength(2);
  });

  it('onResponseDone reports whether the response actually delivered audio', () => {
    // Confirmed on a live call: a turn that's ONLY a tool call (e.g.
    // answer_captured) can finish with ZERO audio chunks — the model
    // doesn't necessarily also speak in the same turn. The caller needs
    // this signal to decide whether to prompt a continuation.
    const handlers = makeHandlers();
    setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();

    socket._message({
      type: 'response.function_call_arguments.done',
      name: 'answer_captured',
      arguments: '{"question_id":"q1"}',
      call_id: 'call_1'
    });
    socket._message({ type: 'response.done' });
    expect(handlers.onResponseDone).toHaveBeenCalledWith(false);

    handlers.onResponseDone.mockClear();
    socket._message({ type: 'response.output_audio.delta', delta: Buffer.from('hi').toString('base64') });
    socket._message({ type: 'response.done' });
    expect(handlers.onResponseDone).toHaveBeenCalledWith(true);
  });

  it('continueConversation sends response.create only when no response is already in flight', () => {
    const handlers = makeHandlers();
    const session = setupRealtime('x', handlers);
    const socket = FakeWebSocket.instances[0];
    socket._open();
    socket.sent.length = 0;

    session.continueConversation();
    expect(socket.sent.filter(m => m.type === 'response.create')).toHaveLength(1);

    // A response is now in flight (botSpeaking) — must not send a second
    // response.create, which the API rejects outright.
    session.continueConversation();
    expect(socket.sent.filter(m => m.type === 'response.create')).toHaveLength(1);
  });
});
