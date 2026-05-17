import textToSpeech from '@google-cloud/text-to-speech';

let googleTtsClient = null;
try {
  if (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    googleTtsClient = new textToSpeech.TextToSpeechClient({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }
    });
  } else {
    console.warn('[TTS] Google TTS credentials (GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY) are missing. Google TTS will fail if requested.');
  }
} catch (e) {
  console.warn('[TTS] Google TTS Client failed to initialize.', e.message);
}

/**
 * Converts text to audio using the correct provider and sends it to Twilio WebSocket.
 */
export async function speakBackToTwilio(ws, streamSid, text, language = 'English') {
  const provider = language === 'English' ? 'deepgram' : 'google';
  console.log(`[TTS] Generating audio via ${provider} for: "${text.substring(0, 30)}..."`);

  if (provider === 'deepgram') {
    return speakDeepgram(ws, streamSid, text);
  } else {
    return speakGoogle(ws, streamSid, text, language);
  }
}

async function speakDeepgram(ws, streamSid, text) {
  try {
    const response = await fetch(`https://api.deepgram.com/v1/speak?model=aura-asteria-en&encoding=mulaw&container=none&sample_rate=8000`, {
      method: "POST",
      headers: {
        "Authorization": `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
       const errBody = await response.text();
       throw new Error(`Deepgram TTS failed: ${response.status} ${errBody}`);
    }

    if (!response.body) {
      console.error('[TTS/Deepgram] No stream returned by fetch');
      return false;
    }

    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Send audio chunk to Twilio
      ws.send(JSON.stringify({
        event: 'media',
        streamSid,
        media: {
          payload: Buffer.from(value).toString('base64'),
        }
      }));
    }
    
    // Append a mark to know exactly when Twilio has finished playing all this audio
    ws.send(JSON.stringify({
      event: 'mark',
      streamSid,
      mark: { name: 'end_of_tts' }
    }));
    
    console.log('[TTS/Deepgram] Finished streaming audio back to Twilio');
    return true;

  } catch (err) {
    console.error('[TTS/Deepgram] Error generating audio:', err);
    return false;
  }
}

async function speakGoogle(ws, streamSid, text, language) {
  if (!googleTtsClient) {
    console.error('[TTS/Google] Client not initialized. Cannot speak.');
    return false;
  }

  try {
    const request = {
      input: { text: text },
      // Select the voice. hi-IN-Neural2-D is a high quality female Hindi voice
      voice: { languageCode: 'hi-IN', name: 'hi-IN-Neural2-D' },
      audioConfig: { 
        audioEncoding: 'MULAW',
        sampleRateHertz: 8000
      },
    };

    const [response] = await googleTtsClient.synthesizeSpeech(request);
    
    // Google returns the entire audio payload at once in response.audioContent (Uint8Array)
    // Twilio needs base64
    const audioBase64 = Buffer.from(response.audioContent).toString('base64');
    
    // We can chunk it manually to not overwhelm the websocket, but Twilio can handle moderately sized chunks.
    // For safety, let's chunk it into 4KB pieces
    const chunkSize = 4096;
    for (let i = 0; i < audioBase64.length; i += chunkSize) {
      const chunk = audioBase64.slice(i, i + chunkSize);
      ws.send(JSON.stringify({
        event: 'media',
        streamSid,
        media: {
          payload: chunk
        }
      }));
    }

    ws.send(JSON.stringify({
      event: 'mark',
      streamSid,
      mark: { name: 'end_of_tts' }
    }));

    console.log('[TTS/Google] Finished streaming audio back to Twilio');
    return true;
  } catch (err) {
    console.error('[TTS/Google] Error generating audio:', err);
    return false;
  }
}
