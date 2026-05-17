import client from 'ari-client';
import path from 'path';

// Note: Asterisk's ARI connects via WebSocket and HTTP.
const ARI_URL = process.env.ARI_URL || 'http://localhost:8088';
const ARI_USER = process.env.ARI_USER || 'asterisk';
const ARI_PASS = process.env.ARI_PASS || 'asterisk';

export async function makeAsteriskCall(callData) {
  const { phone, callLogId } = callData;

  return new Promise((resolve, reject) => {
    client.connect(ARI_URL, ARI_USER, ARI_PASS, (err, ari) => {
      if (err) {
        console.error('ARI Connection Error:', err);
        return reject(err);
      }

      // Start the application context we define in Asterisk config
      ari.start('hello-world'); 
      
      const outgoing = ari.Channel();

      outgoing.on('StasisStart', (event, channel) => {
        console.log(`[Asterisk] Call answered by ${phone}. Starting playback and recording...`);
        
        // 1. Play Pre-recorded audio
        // The audio file path needs to be accessible by the Asterisk container
        const playback = ari.Playback();
        const soundFile = `sound:hello-world`; // Assuming hello-world built-in sound is present for MVP testing.
        
        // 2. Start Recording
        const filename = `call_${callLogId}_${Date.now()}`;
        channel.record({ name: filename, format: 'wav' })
          .then(liveRecording => {
            console.log(`[Asterisk] Recording started: ${filename}.wav`);
            
            // Hangup event handling
            channel.on('StasisEnd', () => {
              console.log(`[Asterisk] Call ended for ${phone}.`);
              resolve({
                status: 'completed',
                transcript: 'Asterisk completed playback.',
                recordingUrl: `http://localhost:3000/recordings/${filename}.wav`,
                durationMs: 0 // Duration parsing can be added later
              });
            });

            // Play the audio
            channel.play({ media: soundFile }, playback)
              .catch(e => console.error("Playback error", e));
              
            // Hacky fallback to hangup after 10s for MVP if playback end isn't caught
            setTimeout(() => { channel.hangup(); }, 10000);
          })
          .catch(e => reject(e));
      });

      // Originate the call
      outgoing.originate(
        {
          endpoint: `PJSIP/${phone}@mytrunk`, // Configure trunk dynamically based on user config normally
          app: 'hello-world',
          appArgs: 'dialed'
        },
        (err, channel) => {
          if (err) {
             console.error(`[Asterisk] Failed to originate call to ${phone}`, err);
             return reject(err);
          }
          console.log(`[Asterisk] Ringing ${phone}...`);
        }
      );
    });
  });
}
