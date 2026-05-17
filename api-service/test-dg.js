import { DeepgramClient } from '@deepgram/sdk';
import 'dotenv/config';

const deepgram = new DeepgramClient();

async function run() {
  console.log("Connecting...");
  const dgConnection = await deepgram.listen.v1.connect({
      model: 'nova-2-phonecall',
      smart_format: true,
      encoding: 'mulaw',
      sample_rate: 8000,
      interim_results: true,
      endpointing: 300,
  });

  dgConnection.on('open', () => {
    console.log('[Deepgram] WebSocket connection opened');
  });
  dgConnection.on('error', (err) => {
    console.error('[Deepgram] Connection Error:', err);
  });
  dgConnection.on('close', () => {
    console.log('[Deepgram] Connection Closed');
  });

  dgConnection.connect();
  console.log("Called connect() on socket");
}

run();
