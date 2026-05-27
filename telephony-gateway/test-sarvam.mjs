// Quick test: verify Sarvam REST /speech-to-text accepts the API key
// and returns a transcript for a small silent WAV (should return empty string, not 403).
import { readFileSync } from 'fs';

const key = process.env.SARVAM_API_KEY || 'sk_5v14gx22_VGSujH1Rr5wGtvtsg9P0pB42';

// Build a minimal 1-second silent WAV (8 kHz, 16-bit, mono)
function silentWav(durationMs = 500) {
  const sampleRate  = 8000;
  const samples     = Math.floor(sampleRate * durationMs / 1000);
  const pcm         = Buffer.alloc(samples * 2, 0);
  const dataSize    = pcm.length;
  const header      = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

async function testRestApi() {
  console.log('Testing Sarvam REST /speech-to-text with 500ms silent WAV...');
  const wav = silentWav(500);

  const formData = new FormData();
  formData.append('file', new Blob([wav], { type: 'audio/wav' }), 'audio.wav');
  formData.append('model', 'saaras:v3');
  formData.append('language_code', 'en-IN');

  const response = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: { 'api-subscription-key': key },
    body: formData
  });

  const body = await response.text();
  console.log(`Status: ${response.status}`);
  console.log(`Body: ${body.slice(0, 400)}`);

  if (response.ok) {
    console.log('\n✓ Sarvam REST API is working — STT will use REST mode for phone calls');
  } else {
    console.log('\n✗ Sarvam REST API failed');
  }
}

testRestApi().catch(console.error);
