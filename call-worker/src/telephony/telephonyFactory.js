import { simulateCall }    from './mockTelephony.js';
import { makeAsteriskCall } from './asteriskAdapter.js';
import { makePlivoCall }   from './plivoAdapter.js';

export async function processOutboundCall(callData) {
  const provider = process.env.TELEPHONY_PROVIDER || 'mock';
  console.log(`[Telephony] Routing call via ${provider} provider...`);

  if (provider === 'plivo')    return await makePlivoCall(callData);
  if (provider === 'asterisk') return await makeAsteriskCall(callData);
  return await simulateCall(callData);
}
