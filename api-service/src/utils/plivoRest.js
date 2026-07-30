// Small Plivo REST helper for api-service — reimplements the couple of calls
// this service needs directly, matching telephony-gateway's plivoRest.js
// (separate services/containers, no shared module graph).

function plivoHeaders(authId, authToken) {
  return {
    'Authorization': `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`,
    'Content-Type':  'application/json',
  };
}

export async function hangupPlivoCall(callUuid) {
  const authId    = process.env.PLIVO_AUTH_ID;
  const authToken = process.env.PLIVO_AUTH_TOKEN;
  const res = await fetch(`https://api.plivo.com/v1/Account/${authId}/Call/${callUuid}/`, {
    method:  'DELETE',
    headers: plivoHeaders(authId, authToken),
  });
  return res.ok;
}

export async function fetchPlivoRecordingUrl(callUuid) {
  const authId    = process.env.PLIVO_AUTH_ID;
  const authToken = process.env.PLIVO_AUTH_TOKEN;
  const res = await fetch(
    `https://api.plivo.com/v1/Account/${authId}/Recording/?call_uuid=${encodeURIComponent(callUuid)}&limit=1`,
    { headers: plivoHeaders(authId, authToken) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.objects?.[0]?.recording_url ?? null;
}
