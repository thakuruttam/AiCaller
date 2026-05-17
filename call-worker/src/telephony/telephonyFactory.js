import { simulateCall } from './mockTelephony.js';
import { makeAsteriskCall } from './asteriskAdapter.js';
import { makeTwilioCall } from './twilioAdapter.js';

export async function processOutboundCall(callData) {
  // We can switch this via env var or call config later
  const provider = process.env.TELEPHONY_PROVIDER || 'mock';
  
  console.log(`[Telephony] Routing call via ${provider} provider...`);
  
  if (provider === 'asterisk') {
     return await makeAsteriskCall(callData);
  } else if (provider === 'twilio') {
     return await makeTwilioCall(callData);
  } else {
     // Default fallback
     return await simulateCall(callData);
  }
}
