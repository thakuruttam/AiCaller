import { WebSocket } from 'ws';
import speech from '@google-cloud/speech';

// Singleton Google Speech Client
let googleSpeechClient = null;
try {
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    googleSpeechClient = new speech.SpeechClient({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }
    });
  } else {
    console.warn('[STT] Google STT credentials (GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY) are missing. Google STT will fail if requested.');
  }
} catch (e) {
  console.warn('[STT] Google Speech Client failed to initialize.', e.message);
}

/**
 * Creates an STT stream and returns an object with `sendAudio(buffer)` and `close()`.
 * @param {string} language - Campaign language ('English', 'Hindi', 'Hinglish')
 * @param {Object} handlers - { onTranscript: (text) => void, onError: (err) => void, onClose: () => void }
 */
export function setupSTT(language, handlers, encoding = 'mulaw') {
  // English calls use Deepgram: its native streaming has two independent
  // silence thresholds (a fast partial-final endpoint plus a separate,
  // slower UtteranceEnd) that correctly tell a mid-sentence pause apart
  // from the user actually finishing. Sarvam's REST/VAD integration only
  // has one threshold doing both jobs, which caused real production calls
  // to get interrupted with "Are you still there?" mid-answer and have a
  // single long answer split into two turns (repeating the question) —
  // see git history on providers/stt.js for the incident.
  //
  // Sarvam is kept for Hindi/Hinglish, where it was adopted specifically
  // for its phone-call-tuned accuracy on Indian accents and code-mixing —
  // a trade-off worth keeping despite the turn-taking gap above.
  if (language !== 'English' && process.env.SARVAM_API_KEY) {
    console.log(`[STT] Initializing Sarvam AI (REST) for language: ${language}`);
    return setupSarvamRest(language, handlers, encoding);
  }

  const provider = language === 'English' ? 'deepgram' : 'google';
  console.log(`[STT] Initializing ${provider} STT for language: ${language}`);
  return provider === 'deepgram' ? setupDeepgram(language, handlers, encoding) : setupGoogle(language, handlers, encoding);
}

function setupDeepgram(language, handlers, encoding = 'mulaw') {
  const buildDeepgramUrl = (lang) => {
    // endpointing=500: Deepgram fires is_final after 500ms of silence — keeps interim
    // transcripts fast so the accumulator builds up incrementally.
    // utterance_end_ms=2000: Deepgram fires an UtteranceEnd event after 2 seconds of
    // no new words. This is the authoritative "user is done speaking" signal we use
    // to flush the transcript immediately, rather than relying on the 200ms fallback
    // timer. Works even when background noise prevents endpointing from firing cleanly.
    const encodingParam = encoding === 'pcm16' ? 'encoding=linear16' : 'encoding=mulaw';
    const base = `smart_format=true&${encodingParam}&sample_rate=8000&interim_results=true&endpointing=500&utterance_end_ms=2000`;
    if (lang === 'Hinglish') {
      return `wss://api.deepgram.com/v1/listen?model=nova-3&${base}&language=multi`;
    } else if (lang === 'Hindi') {
      return `wss://api.deepgram.com/v1/listen?model=nova-2&${base}&language=hi`;
    }
    return `wss://api.deepgram.com/v1/listen?model=nova-3&${base}&language=en-IN`;
  };

  const dgConnection = new WebSocket(buildDeepgramUrl(language), {
    headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` }
  });

  dgConnection.on('open', () => {
    console.log('[STT/Deepgram] WebSocket connection opened');
  });

  dgConnection.on('message', (messageData) => {
    let data;
    try {
      data = JSON.parse(messageData);
    } catch (e) {
      return;
    }

    if (data.type === 'Results') {
      const transcript = data.channel?.alternatives?.[0]?.transcript;
      if (transcript) {
        // Interim or final — either way it's real speech, so reset the
        // caller's "no answer" timer. Deepgram's fast endpointing already
        // makes this rare to need, but a fluent answer with no natural
        // sub-500ms pause could otherwise still hit the flat no-answer
        // timeout mid-sentence.
        handlers.onSpeechActivity?.();
        if (data.is_final) handlers.onTranscript(transcript);
      }
    }

    // UtteranceEnd fires after utterance_end_ms of silence with no new words.
    // This is the definitive signal that the user has finished their turn.
    if (data.type === 'UtteranceEnd') {
      console.log('[STT/Deepgram] UtteranceEnd received — user finished speaking');
      handlers.onUtteranceEnd?.();
    }
  });

  dgConnection.on('error', (err) => {
    console.error('[STT/Deepgram] Connection Error:', err.message);
    if (handlers.onError) handlers.onError(err);
  });

  dgConnection.on('close', () => {
    console.log('[STT/Deepgram] Connection Closed');
    if (handlers.onClose) handlers.onClose();
  });

  return {
    sendAudio: (buffer) => {
      if (dgConnection.readyState === 1 /* OPEN */) {
        dgConnection.send(buffer);
      }
    },
    close: () => {
      try { dgConnection.close(); } catch (e) {}
    }
  };
}

function setupGoogle(language, handlers, encoding = 'mulaw') {
  if (!googleSpeechClient) {
    console.error('[STT/Google] Cannot start Google STT — client not initialized (missing credentials?)');
    return { sendAudio: () => {}, close: () => {} };
  }

  // Determine Google language code
  // For Hinglish, we can provide multiple language codes for code-switching, but it's simpler to use hi-IN as it supports English loan words.
  // We'll use hi-IN as the primary. You can also pass alternativeLanguageCodes if needed.
  const languageCode = 'hi-IN';

  const request = {
    config: {
      encoding: encoding === 'pcm16' ? 'LINEAR16' : 'MULAW',
      sampleRateHertz: 8000,
      languageCode: languageCode,
      alternativeLanguageCodes: language === 'Hinglish' ? ['en-IN'] : [],
      model: 'telephony' // best for phone calls
    },
    interimResults: true, // We need this to get rapid feedback, though we only act on isFinal
  };

  const recognizeStream = googleSpeechClient
    .streamingRecognize(request)
    .on('error', (err) => {
      console.error('[STT/Google] Stream Error:', err.message);
      if (handlers.onError) handlers.onError(err);
    })
    .on('data', (data) => {
      if (data.results[0] && data.results[0].alternatives[0]) {
        handlers.onSpeechActivity?.();
        const isFinal = data.results[0].isFinal;
        if (isFinal) {
          const transcript = data.results[0].alternatives[0].transcript;
          handlers.onTranscript(transcript);
        }
      }
    })
    .on('end', () => {
      console.log('[STT/Google] Stream Ended');
      if (handlers.onClose) handlers.onClose();
    });

  return {
    sendAudio: (buffer) => {
      // recogniseStream is a writable stream
      if (!recognizeStream.destroyed) {
        recognizeStream.write(buffer);
      }
    },
    close: () => {
      try { recognizeStream.end(); } catch (e) {}
    }
  };
}

// ── G.711 μ-law → 16-bit PCM conversion ──────────────────────────────
// Plivo Audio Streaming sends mulaw-encoded 8 kHz audio.
// Sarvam AI REST expects a WAV file (pcm_s16le).  This lookup table is
// built once at module load and used for every audio chunk.
const MULAW_DECODE = new Int16Array(256);
(function buildMulawTable() {
  for (let i = 0; i < 256; i++) {
    const b    = ~i & 0xFF;
    const sign = b & 0x80;
    const exp  = (b >> 4) & 0x07;
    const mant = b & 0x0F;
    let linear = ((mant << 3) + 0x84) << exp;
    MULAW_DECODE[i] = sign ? -linear : linear;
  }
})();

function mulawToPCM16(mulawBuffer) {
  const pcm = Buffer.alloc(mulawBuffer.length * 2);
  for (let i = 0; i < mulawBuffer.length; i++) {
    pcm.writeInt16LE(MULAW_DECODE[mulawBuffer[i]], i * 2);
  }
  return pcm;
}

// Build a minimal WAV container around raw PCM16 data.
function pcmToWav(pcmBuffer, sampleRate) {
  const channels      = 1;
  const bitsPerSample = 16;
  const byteRate      = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign    = channels * (bitsPerSample / 8);
  const dataSize      = pcmBuffer.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);         // PCM fmt chunk size
  header.writeUInt16LE(1, 20);          // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

// POST a WAV buffer to Sarvam REST API and return the transcript string.
async function transcribeWithSarvam(wavBuffer, languageCode, mode, apiKey) {
  const formData = new FormData();
  formData.append('file', new Blob([wavBuffer], { type: 'audio/wav' }), 'audio.wav');
  formData.append('model', 'saaras:v3');
  formData.append('language_code', languageCode);
  if (mode === 'codemix') formData.append('mode', mode);

  const response = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey },
    body: formData
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Sarvam REST ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  // Sarvam may return transcript at different paths depending on model/version
  return data.transcript ?? data.text ?? data.data?.transcript ?? null;
}

// ── Sarvam AI STT provider (REST batch mode) ──────────────────────────
// Plivo sends mulaw audio continuously. We use energy-based VAD to
// detect when the user starts and stops speaking, then POST the buffered
// audio to the Sarvam REST /speech-to-text endpoint and fire onTranscript
// + onUtteranceEnd once the response arrives (~300-500ms latency).
function setupSarvamRest(language, handlers, encoding = 'mulaw') {
  const langCode = language === 'Hindi' || language === 'Hinglish' ? 'hi-IN' : 'en-IN';
  const mode     = language === 'Hinglish' ? 'codemix' : 'transcribe';
  const apiKey   = process.env.SARVAM_API_KEY;

  // Plivo sends 160-byte mulaw packets every 20 ms (8 kHz, 20 ms/frame).
  const SPEECH_THRESHOLD       = 500;   // RMS above this → speech (vs background noise)
  // 2 s of silence before treating the turn as over. Real call transcripts
  // showed answers getting cut mid-sentence ("Sure, my current role, I am
  // working as a" / "Uh, yes, I'm working as a lead Q.") at the previous
  // 1.8s threshold — someone composing an answer on the spot pauses mid-
  // clause more than that. Env-overridable for further tuning without a
  // redeploy if it still cuts people off.
  const SILENCE_FRAMES_TO_FLUSH = parseInt(process.env.SARVAM_SILENCE_FRAMES_TO_FLUSH || '100', 10); // 100 × 20 ms = 2000 ms
  const MIN_SPEECH_FRAMES       = 5;    // < 100 ms = noise burst, skip
  // Sarvam's real-time REST endpoint hard-rejects audio over 30s (400 error).
  // If someone talks continuously with no pause, waiting for silence would
  // eventually blow past that cap and lose the whole utterance to an error.
  // Force a mid-utterance split well under the limit instead.
  const MAX_BUFFER_FRAMES       = 1250; // 1250 × 20 ms = 25,000 ms

  // Barge-in specifically (the onSpeechStart callback that makes the stream
  // handler clearAudio and cut the bot off) needs a much stricter gate than
  // regular speech capture. There's no acoustic echo cancellation on this
  // pipeline, so the tail of the bot's own TTS leaking back in — over a
  // speakerphone, a noisy line, or just imperfect handset isolation — reads
  // as "speech" under the plain SPEECH_THRESHOLD/MIN_SPEECH_FRAMES gate and
  // was clearing the bot's own audio mid-word (reported as questions cut off
  // by the last few letters, or occasionally skipped almost entirely when
  // the false trigger landed right as the audio started). A genuine
  // interruption from a phone mic is reliably louder and more sustained than
  // that leaked echo, so require both a higher energy floor and a longer
  // sustained run before honoring it as a real barge-in. Regular transcript
  // capture below is untouched — this only gates the interrupt trigger.
  const BARGE_IN_ENERGY_THRESHOLD = parseInt(process.env.SARVAM_BARGE_IN_ENERGY_THRESHOLD || '1400', 10);
  const BARGE_IN_MIN_FRAMES       = parseInt(process.env.SARVAM_BARGE_IN_MIN_FRAMES || '15', 10); // 15 × 20 ms = 300 ms

  let audioChunks   = [];     // PCM16 buffers buffered during the current utterance
  let silenceFrames = 0;      // consecutive silent frames since last speech frame
  let hasSpeech     = false;  // currently inside a speech segment
  let transcribing  = false;  // API call in flight — guard against overlap
  let speechStartFired = false; // onSpeechStart (barge-in trigger) already fired for this utterance
  let bargeInFrames = 0;      // consecutive frames at/above BARGE_IN_ENERGY_THRESHOLD

  // ── Diagnostics for "answer got cut off with no audible pause" reports ──
  // Plivo's <Stream> media WS and its separate call recording are two
  // independent capture paths — a transcript truncated mid-sentence with no
  // matching gap in the recording could mean the WS stream lost/delayed
  // packets that never reached this pipeline at all, which no VAD threshold
  // tuning can fix. Plivo sends one 160-byte mulaw frame every ~20ms, so any
  // materially larger gap between sendAudio() calls is a direct signal of
  // that, independent of audio content. Track it and surface it right next
  // to the existing "End of speech" log so a real gap vs. a threshold
  // problem is obvious from the logs alone on the next occurrence.
  let lastPacketAt = null;          // wall-clock ms of the previous sendAudio() call
  let maxGapThisUtterance = 0;      // largest inter-packet gap seen since hasSpeech went true
  let maxSilentEnergyThisRun = 0;   // loudest frame counted as "silence" in the current silenceFrames run
  const PACKET_GAP_WARN_MS = parseInt(process.env.SARVAM_PACKET_GAP_WARN_MS || '100', 10);

  // ── Same-breath continuation merge ───────────────────────────────────
  // Sarvam has only ONE silence threshold (SILENCE_FRAMES_TO_FLUSH) that
  // does double duty as both "flush this chunk for transcription" and
  // "the user's turn is over" — unlike Deepgram, which has a fast endpoint
  // threshold for partial finals plus a much slower, independent
  // utterance_end_ms as the real turn-over signal. Without that second
  // tier, a single natural mid-sentence pause (a real call showed "So I
  // have not worked" <pause> "on any of these" — one answer) gets treated
  // as two separate, complete turns: the first gets judged incomplete and
  // the question gets re-asked mid-answer, which is what actually reads to
  // a caller as "the bot interrupts me and repeats itself." Hold a final
  // segment briefly — if a new speech segment starts and flushes within
  // the grace window, merge its text into the same turn instead of
  // delivering onUtteranceEnd early.
  let mergedText = null;
  let mergeGraceTimer = null;
  const MERGE_GRACE_MS = parseInt(process.env.SARVAM_MERGE_GRACE_MS || '1000', 10);

  function armMergeGrace() {
    if (mergeGraceTimer) clearTimeout(mergeGraceTimer);
    mergeGraceTimer = setTimeout(deliverMergedTranscript, MERGE_GRACE_MS);
  }

  function deliverMergedTranscript() {
    const text = mergedText;
    mergedText = null;
    mergeGraceTimer = null;
    if (text) {
      handlers.onTranscript(text);
      handlers.onUtteranceEnd?.();
    }
  }

  function resetSpeechState() {
    hasSpeech = false;
    silenceFrames = 0;
    speechStartFired = false;
    bargeInFrames = 0;
    maxGapThisUtterance = 0;
    maxSilentEnergyThisRun = 0;
  }

  function rms(buf) {
    let sum = 0;
    const n = buf.length / 2;
    for (let i = 0; i < buf.length; i += 2) {
      const s = buf.readInt16LE(i);
      sum += s * s;
    }
    return Math.sqrt(sum / n);
  }

  /**
   * @param {boolean} isFinal - true when triggered by an actual silence gap
   *   (the user's turn is over). false when force-split because the buffer
   *   hit MAX_BUFFER_FRAMES while the user is still actively talking — in
   *   that case we transcribe what we have so far but keep listening as the
   *   same ongoing turn instead of ending it.
   */
  function flushSpeech(isFinal = true) {
    const maxGap = maxGapThisUtterance; // read before resetSpeechState() zeroes it

    if (transcribing) {
      // Previous API call still running — drop this segment to stay in sync.
      audioChunks = [];
      if (isFinal) {
        resetSpeechState();
        // A merge was pending on an earlier segment and this attempt to
        // extend it produced nothing usable — don't strand it, make sure
        // it still gets delivered.
        if (mergedText !== null) armMergeGrace();
      }
      return;
    }

    if (audioChunks.length < MIN_SPEECH_FRAMES) {
      audioChunks = [];
      if (isFinal) {
        resetSpeechState();
        if (mergedText !== null) armMergeGrace();
      }
      return;
    }

    const chunks = audioChunks;
    audioChunks  = [];
    if (isFinal) resetSpeechState();
    transcribing = true;

    const pcm = Buffer.concat(chunks);
    const durationMs = (pcm.length / 2 / 8000 * 1000).toFixed(0);
    if (maxGap > PACKET_GAP_WARN_MS) {
      console.warn(`[STT/Sarvam REST] This segment's largest inter-packet gap was ${maxGap}ms — if the transcript looks cut short, this is likely why`);
    }
    console.log(`[STT/Sarvam REST] Transcribing ${durationMs}ms of speech${isFinal ? '' : ' (mid-utterance split — still speaking)'}...`);

    const wav = pcmToWav(pcm, 8000);
    transcribeWithSarvam(wav, langCode, mode, apiKey)
      .then(text => {
        transcribing = false;
        if (text?.trim()) {
          console.log(`[STT/Sarvam REST] Transcript: "${text}"`);
          if (isFinal) {
            // Hold this segment briefly instead of delivering it right away —
            // if the caller resumes speaking within MERGE_GRACE_MS (a
            // mid-sentence pause rather than the end of their turn), the next
            // segment's text gets appended here and delivered as ONE turn.
            // See the merge-state comment above for why this is needed.
            mergedText = mergedText ? `${mergedText} ${text}` : text;
            armMergeGrace();
          } else {
            // Mid-utterance split (still speaking) — deliver immediately,
            // no merge needed since the turn is known to be ongoing.
            handlers.onTranscript(text);
          }
        } else if (isFinal && mergedText !== null) {
          // This segment transcribed to nothing, but a merge was pending —
          // don't strand it.
          armMergeGrace();
        }
      })
      .catch(err => {
        transcribing = false;
        console.error('[STT/Sarvam REST] Error:', err.message);
        handlers.onError?.(err);
        if (isFinal && mergedText !== null) armMergeGrace();
      });
  }

  return {
    sendAudio(rawBuffer) {
      const now = Date.now();
      if (lastPacketAt !== null) {
        const gap = now - lastPacketAt;
        if (hasSpeech && gap > maxGapThisUtterance) maxGapThisUtterance = gap;
        if (gap > PACKET_GAP_WARN_MS) {
          console.warn(`[STT/Sarvam REST] Audio packet gap: ${gap}ms since previous packet (expected ~20ms)${hasSpeech ? ' — DURING an active utterance, could look like silence with no real pause' : ''}`);
        }
      }
      lastPacketAt = now;

      const pcm     = encoding === 'pcm16' ? rawBuffer : mulawToPCM16(rawBuffer);
      const energy  = rms(pcm);

      if (energy >= SPEECH_THRESHOLD) {
        // Real speech energy, independent of whether it's ever produced a
        // transcript yet — resets the caller's "no answer" timer so a long
        // answer (or one with normal pauses) can't get interrupted with
        // "Are you still there?" just because Sarvam hasn't flushed a
        // completed segment within that window yet.
        handlers.onSpeechActivity?.();
        if (!hasSpeech) {
          hasSpeech     = true;
          silenceFrames = 0;
          console.log('[STT/Sarvam REST] Speech started (buffering)');
          // The caller resumed talking — pause delivery of any pending
          // merged segment until we see whether this is more of the same
          // answer (handled by the merge logic in flushSpeech) or not.
          if (mergeGraceTimer) { clearTimeout(mergeGraceTimer); mergeGraceTimer = null; }
        }
        silenceFrames = 0;
        maxSilentEnergyThisRun = 0;
        audioChunks.push(pcm);
        // Only signal barge-in once LOUD speech has been sustained for
        // BARGE_IN_MIN_FRAMES — see the constants above for why this needs to
        // be stricter than plain speech detection (no echo cancellation).
        bargeInFrames = energy >= BARGE_IN_ENERGY_THRESHOLD ? bargeInFrames + 1 : 0;
        if (!speechStartFired && bargeInFrames >= BARGE_IN_MIN_FRAMES) {
          speechStartFired = true;
          console.log('[STT/Sarvam REST] Sustained loud speech confirmed — signaling barge-in');
          handlers.onSpeechStart?.();
        }
        if (audioChunks.length >= MAX_BUFFER_FRAMES) {
          console.log('[STT/Sarvam REST] Max buffer duration reached — splitting long utterance');
          flushSpeech(false);
        }
      } else if (hasSpeech) {
        // Silence during an active utterance — keep buffering (natural mid-sentence pauses)
        silenceFrames++;
        if (energy > maxSilentEnergyThisRun) maxSilentEnergyThisRun = energy;
        audioChunks.push(pcm);
        if (audioChunks.length >= MAX_BUFFER_FRAMES) {
          console.log('[STT/Sarvam REST] Max buffer duration reached — splitting long utterance');
          flushSpeech(false);
        } else if (silenceFrames >= SILENCE_FRAMES_TO_FLUSH) {
          // Distinguishes true silence/dropped audio (energy near 0) from
          // quiet-but-present speech that never quite cleared SPEECH_THRESHOLD
          // (energy close to it) — the latter means the threshold itself is
          // too strict for this call, not that the person actually paused.
          console.log(`[STT/Sarvam REST] End of speech — flushing buffer (loudest "silent" frame in this gap: ${maxSilentEnergyThisRun.toFixed(0)} RMS, threshold ${SPEECH_THRESHOLD})`);
          maxSilentEnergyThisRun = 0;
          flushSpeech(true);
        }
      }
    },
    close() {
      audioChunks  = [];
      transcribing = false;
      if (mergeGraceTimer) { clearTimeout(mergeGraceTimer); mergeGraceTimer = null; }
      mergedText = null;
    }
  };
}
