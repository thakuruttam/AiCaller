import { prisma } from '../db.js';

/**
 * Plivo adapter — outbound calling via Plivo's REST API.
 *
 * Required env vars:
 *   PLIVO_AUTH_ID       — from Plivo console → Overview
 *   PLIVO_AUTH_TOKEN    — from Plivo console → Overview
 *   PLIVO_PHONE_NUMBER  — your Plivo number in E.164 format (e.g. +14157654321)
 *
 * Plivo's Make Call API only returns a request_uuid (the outbound attempt), not
 * the real call_uuid — that arrives later via the answer_url webhook / the
 * WebSocket 'start' event's callId. providerRef is overwritten there
 * (mirrors plivoStreamHandler's 'start' handler).
 */

function plivoHeaders(authId, authToken) {
  return {
    'Authorization': `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`,
    'Content-Type':  'application/json',
  };
}

export async function makePlivoCall(callData) {
  const { phone, callLogId, campaignId } = callData;

  const authId    = process.env.PLIVO_AUTH_ID;
  const authToken = process.env.PLIVO_AUTH_TOKEN;
  const fromPhone = process.env.PLIVO_PHONE_NUMBER;
  const baseUrl   = (process.env.BASE_URL || '').replace(/\/$/, '');

  if (!authId || !authToken || !fromPhone) {
    throw new Error('Plivo credentials (PLIVO_AUTH_ID, PLIVO_AUTH_TOKEN, PLIVO_PHONE_NUMBER) missing in .env');
  }
  if (!baseUrl) throw new Error('BASE_URL is required in .env (e.g. https://yourserver.com)');

  const answerUrl  = `${baseUrl}/call/answer?campaignId=${encodeURIComponent(campaignId)}&callLogId=${encodeURIComponent(callLogId)}`;
  const hangupUrl  = `${baseUrl}/call/status`;
  const endpoint   = `https://api.plivo.com/v1/Account/${authId}/Call/`;

  console.log(`[Plivo] Dialing ${phone} from ${fromPhone}...`);

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: plivoHeaders(authId, authToken),
    body: JSON.stringify({
      from:           fromPhone,
      to:             phone,
      answer_url:     answerUrl,
      answer_method:  'POST',
      hangup_url:     hangupUrl,
      hangup_method:  'POST',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Plivo call failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const requestUuid = data.request_uuid;

  console.log(`[Plivo] Call fired — request_uuid: ${requestUuid} (real call_uuid arrives via /call/answer)`);

  await prisma.callLog.update({
    where: { id: callLogId },
    data:  { providerRef: requestUuid },
  });

  // Return immediately — plivoStreamHandler's /call/status + WS 'start' event
  // handle transcript saving, recording, and evaluation queuing when the call ends.
  return { status: 'in-progress', callSid: requestUuid, recordingUrl: null, durationMs: 0 };
}
