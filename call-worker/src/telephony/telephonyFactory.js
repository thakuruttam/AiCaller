import { simulateCall }         from './mockTelephony.js';
import { makeAsteriskCall }      from './asteriskAdapter.js';
import { makeTwilioCall }        from './twilioAdapter.js';
import { makeTelnyxCall }        from './telnyxAdapter.js';
import { makeSignalWireCall }    from './signalwireAdapter.js';

export async function processOutboundCall(callData) {
  const provider = process.env.TELEPHONY_PROVIDER || 'mock';
  console.log(`[Telephony] Routing call via ${provider} provider...`);

  if (provider === 'signalwire') return await makeSignalWireCall(callData);
  if (provider === 'telnyx')     return await makeTelnyxCall(callData);
  if (provider === 'twilio')     return await makeTwilioCall(callData);
  if (provider === 'asterisk')   return await makeAsteriskCall(callData);
  return await simulateCall(callData);
}
