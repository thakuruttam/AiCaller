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
export function setupSTT(language, handlers) {
  const provider = language === 'English' ? 'deepgram' : 'google';
  console.log(`[STT] Initializing ${provider} STT for language: ${language}`);

  if (provider === 'deepgram') {
    return setupDeepgram(language, handlers);
  } else {
    return setupGoogle(language, handlers);
  }
}

function setupDeepgram(language, handlers) {
  const buildDeepgramUrl = (lang) => {
    // endpointing: ms of silence before Deepgram declares end-of-utterance.
    // Kept at 500ms — short enough to feel responsive, long enough to survive
    // a natural breath mid-sentence without cutting the user off.
    // The 200ms accumulation buffer in twilioStreamHandler catches any remaining
    // split finals, so we don't need a higher value here.
    if (lang === 'Hinglish') {
      return 'wss://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&encoding=mulaw&sample_rate=8000&interim_results=true&endpointing=500&language=multi';
    } else if (lang === 'Hindi') {
      return 'wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&encoding=mulaw&sample_rate=8000&interim_results=true&endpointing=500&language=hi';
    }
    return 'wss://api.deepgram.com/v1/listen?model=nova-2-phonecall&smart_format=true&encoding=mulaw&sample_rate=8000&interim_results=true&endpointing=500&language=en-US';
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
      if (transcript && data.is_final) {
        handlers.onTranscript(transcript);
      }
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

function setupGoogle(language, handlers) {
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
      encoding: 'MULAW',
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
