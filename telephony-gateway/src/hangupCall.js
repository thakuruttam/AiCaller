/** Provider-agnostic call hangup — Plivo / Asterisk */
export async function hangupCall(callSid) {
  const provider = process.env.TELEPHONY_PROVIDER || 'plivo';
  try {
    if (provider === 'plivo') {
      const authId    = process.env.PLIVO_AUTH_ID;
      const authToken = process.env.PLIVO_AUTH_TOKEN;
      const creds     = Buffer.from(`${authId}:${authToken}`).toString('base64');
      await fetch(`https://api.plivo.com/v1/Account/${authId}/Call/${callSid}/`, {
        method:  'DELETE',
        headers: { 'Authorization': `Basic ${creds}` },
      });
    }
    console.log(`[Stream] Hung up call ${callSid} via ${provider}`);
  } catch (err) {
    console.error(`[Stream] Hangup failed for ${callSid}:`, err.message);
  }
}
