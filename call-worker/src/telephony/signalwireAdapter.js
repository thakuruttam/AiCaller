import { prisma } from '../db.js';

/**
 * SignalWire adapter — drop-in replacement for Twilio.
 * SignalWire mirrors Twilio's REST API exactly (same endpoints, same XML).
 *
 * Required env vars:
 *   SIGNALWIRE_PROJECT_ID   — your SignalWire Project ID (like Twilio Account SID)
 *   SIGNALWIRE_API_TOKEN    — your SignalWire API token  (like Twilio Auth Token)
 *   SIGNALWIRE_SPACE_URL    — e.g. yourspace.signalwire.com
 *   SIGNALWIRE_PHONE_NUMBER — your SignalWire number in E.164 format (+1xxx or +91xxx)
 */

function swHeaders(token) {
  const basic = Buffer.from(token).toString('base64');
  return {
    'Authorization': `Basic ${basic}`,
    'Content-Type':  'application/x-www-form-urlencoded',
    'Accept':        'application/json',
  };
}

export async function makeSignalWireCall(callData) {
  const { phone, callLogId, campaignId } = callData;

  const projectId  = process.env.SIGNALWIRE_PROJECT_ID;
  const apiToken   = process.env.SIGNALWIRE_API_TOKEN;
  const spaceUrl   = (process.env.SIGNALWIRE_SPACE_URL || '').replace(/\/$/, '');
  const fromPhone  = process.env.SIGNALWIRE_PHONE_NUMBER;
  const baseUrl    = (process.env.BASE_URL || '').replace(/\/$/, '');

  if (!projectId || !apiToken || !spaceUrl || !fromPhone) {
    throw new Error(
      'SignalWire credentials missing: SIGNALWIRE_PROJECT_ID, SIGNALWIRE_API_TOKEN, ' +
      'SIGNALWIRE_SPACE_URL, SIGNALWIRE_PHONE_NUMBER'
    );
  }
  if (!baseUrl) throw new Error('BASE_URL is required in .env');

  const answerUrl    = `${baseUrl}/call/answer?campaignId=${encodeURIComponent(campaignId)}&callLogId=${encodeURIComponent(callLogId)}`;
  const statusUrl    = `${baseUrl}/call/status`;
  const recordingUrl = `${baseUrl}/call/recording`;

  // SignalWire REST API — identical to Twilio's Calls endpoint
  const endpoint = `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls.json`;
  const creds    = `${projectId}:${apiToken}`;

  const body = new URLSearchParams({
    To:                          phone,
    From:                        fromPhone,
    Url:                         answerUrl,
    Method:                      'POST',
    StatusCallback:              statusUrl,
    StatusCallbackMethod:        'POST',
    StatusCallbackEvent:         'completed failed busy no-answer',
    Record:                      'true',
    RecordingStatusCallback:     recordingUrl,
    RecordingStatusCallbackMethod: 'POST',
  });

  console.log(`[SignalWire] Dialing ${phone} from ${fromPhone}...`);

  const res = await fetch(endpoint, {
    method:  'POST',
    headers: swHeaders(creds),
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`SignalWire call failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  const callSid = data.sid;

  console.log(`[SignalWire] Call initiated — SID: ${callSid}`);

  await prisma.callLog.update({
    where: { id: callLogId },
    data:  { providerRef: callSid },
  });

  return {
    status:       'in-progress',
    callSid,
    recordingUrl: null,
    durationMs:   0,
  };
}

/** Hang up a SignalWire call by SID */
export async function hangupSignalWireCall(callSid) {
  const projectId = process.env.SIGNALWIRE_PROJECT_ID;
  const apiToken  = process.env.SIGNALWIRE_API_TOKEN;
  const spaceUrl  = (process.env.SIGNALWIRE_SPACE_URL || '').replace(/\/$/, '');
  const creds     = `${projectId}:${apiToken}`;

  try {
    await fetch(
      `https://${spaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls/${callSid}.json`,
      {
        method:  'POST',
        headers: swHeaders(creds),
        body:    new URLSearchParams({ Status: 'completed' }),
      }
    );
    console.log(`[SignalWire] Hung up call ${callSid}`);
  } catch (err) {
    console.error(`[SignalWire] Hangup failed for ${callSid}:`, err.message);
  }
}
