import { prisma } from '../db.js';

const TELNYX_API = 'https://api.telnyx.com/v2';

function telnyxHeaders() {
  return {
    'Authorization': `Bearer ${process.env.TELNYX_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export async function makeTelnyxCall(callData) {
  const { phone, callLogId, campaignId } = callData;

  const apiKey        = process.env.TELNYX_API_KEY;
  const connectionId  = process.env.TELNYX_CONNECTION_ID;   // TeXML App ID from Telnyx portal
  const fromPhone     = process.env.TELNYX_PHONE_NUMBER;
  const baseUrl       = (process.env.BASE_URL || '').replace(/\/$/, '');

  if (!apiKey || !connectionId || !fromPhone) {
    throw new Error('Telnyx credentials missing: TELNYX_API_KEY, TELNYX_CONNECTION_ID, TELNYX_PHONE_NUMBER');
  }
  if (!baseUrl) {
    throw new Error('BASE_URL is required in .env');
  }

  const answerUrl    = `${baseUrl}/call/answer?campaignId=${encodeURIComponent(campaignId)}&callLogId=${encodeURIComponent(callLogId)}`;
  const statusUrl    = `${baseUrl}/call/status`;
  const recordingUrl = `${baseUrl}/call/recording`;

  console.log(`[Telnyx] Dialing ${phone} from ${fromPhone}...`);

  const res = await fetch(`${TELNYX_API}/calls`, {
    method: 'POST',
    headers: telnyxHeaders(),
    body: JSON.stringify({
      connection_id:          connectionId,
      to:                     phone,
      from:                   fromPhone,
      webhook_url:            answerUrl,
      webhook_url_method:     'POST',

      // Status callbacks — same events as Twilio
      status_callback:        statusUrl,
      status_callback_method: 'POST',

      // Recording
      record_audio:                  true,
      recording_status_callback:     recordingUrl,
      recording_status_callback_method: 'POST',

      // Answering machine detection off (same as Twilio machineDetection: 'Disable')
      answering_machine_detection:   'disabled',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telnyx call failed (${res.status}): ${err}`);
  }

  const { data } = await res.json();
  const callControlId = data.call_control_id;
  const legId         = data.call_leg_id;

  console.log(`[Telnyx] Call initiated — control_id: ${callControlId}`);

  await prisma.callLog.update({
    where: { id: callLogId },
    data:  { providerRef: callControlId },
  });

  return {
    status:       'in-progress',
    callSid:      callControlId,
    recordingUrl: null,
    durationMs:   0,
  };
}

/** Hang up a Telnyx call by its call_control_id */
export async function hangupTelnyxCall(callControlId) {
  try {
    await fetch(`${TELNYX_API}/calls/${callControlId}/actions/hangup`, {
      method:  'POST',
      headers: telnyxHeaders(),
    });
    console.log(`[Telnyx] Hung up call ${callControlId}`);
  } catch (err) {
    console.error(`[Telnyx] Hangup failed for ${callControlId}:`, err.message);
  }
}
