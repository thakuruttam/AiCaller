// Small Plivo REST helper for telephony-gateway — separate from call-worker's
// plivoAdapter.js since these are independent services/containers with no
// shared module graph (mirrors how hangupCall.js reimplements per-provider
// REST calls rather than importing call-worker's adapters).

function plivoHeaders(authId, authToken) {
  return {
    'Authorization': `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`,
    'Content-Type':  'application/json',
  };
}

/**
 * Starts recording an already-answered call. Called from plivoStreamHandler's
 * WS 'start' handler once the real call_uuid is known (the Make Call response
 * only gives a request_uuid, not the call_uuid needed here).
 */
export async function startPlivoRecording(callUuid) {
  const authId    = process.env.PLIVO_AUTH_ID;
  const authToken = process.env.PLIVO_AUTH_TOKEN;
  const baseUrl   = (process.env.BASE_URL || '').replace(/\/$/, '');

  try {
    const res = await fetch(`https://api.plivo.com/v1/Account/${authId}/Call/${callUuid}/Record/`, {
      method:  'POST',
      headers: plivoHeaders(authId, authToken),
      body: JSON.stringify({
        callback_url:    `${baseUrl}/call/recording`,
        callback_method: 'POST',
        // Plivo's Record API defaults time_limit to 60s, silently truncating
        // every recording to exactly 1 minute regardless of actual call length.
        // Campaigns cap calls at up to 60 minutes (Step1Basics "Max Call
        // Duration"), so match that as the recording ceiling.
        time_limit: 3600,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn(`[Plivo] Start recording failed (${res.status}): ${err}`);
      return;
    }
    console.log(`[Plivo] Recording started for ${callUuid}`);
  } catch (err) {
    console.warn(`[Plivo] Start recording error for ${callUuid}:`, err.message);
  }
}
