// A simple mock for Asterisk/Twilio telephony to fulfill Phase 1 MVP.
export async function simulateCall(callData) {
  return new Promise((resolve, reject) => {
    // Simulate random duration of the call between 2 and 5 seconds
    const duration = Math.floor(Math.random() * 3000) + 2000;
    
    setTimeout(() => {
      // Return a simulated transcript and recording path
      const isSuccess = Math.random() > 0.1; // 90% success rate

      if (isSuccess) {
        resolve({
          status: 'completed',
          transcript: 'Simulated transcript: user picked up, pre-recorded audio played.',
          recordingUrl: `file:///simulated/recordings/${Date.now()}.mp3`,
          durationMs: duration,
        });
      } else {
        resolve({
          status: 'failed',
          transcript: '',
          recordingUrl: null,
          durationMs: duration,
          error: 'User did not pick up'
        });
      }
    }, duration);
  });
}
