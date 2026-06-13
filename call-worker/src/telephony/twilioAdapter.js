import twilio from 'twilio';
import { prisma } from '../db.js';

export async function makeTwilioCall(callData) {
  const { phone, callLogId, campaignId } = callData;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone  = process.env.TWILIO_PHONE_NUMBER;
  const baseUrl    = (process.env.BASE_URL || '').replace(/\/$/, '');

  if (!accountSid || !authToken || !fromPhone) {
    throw new Error('Twilio credentials (SID, AUTH_TOKEN, PHONE_NUMBER) missing in .env');
  }
  if (!baseUrl) {
    throw new Error('BASE_URL is required in .env (e.g. https://yourserver.com)');
  }

  const client = twilio(accountSid, authToken);

  // Embed campaignId + callLogId as query params on the answer URL so the
  // telephony-gateway can load the right campaign on first webhook hit.
  const answerUrl    = `${baseUrl}/call/answer?campaignId=${encodeURIComponent(campaignId)}&callLogId=${encodeURIComponent(callLogId)}`;
  const statusUrl    = `${baseUrl}/call/status`;
  const recordingUrl = `${baseUrl}/call/recording`;
  console.log(`[Twilio] Webhook URLs — answer: ${answerUrl.substring(0, 60)}... status: ${statusUrl} recording: ${recordingUrl}`);

  console.log(`[Twilio] Dialing ${phone} from ${fromPhone}...`);

  const call = await client.calls.create({
    to:   phone,
    from: fromPhone,
    url:  answerUrl,
    method: 'POST',

    // Status callback fires on terminal events so the gateway saves transcript + queues eval
    statusCallback:       statusUrl,
    statusCallbackMethod: 'POST',
    statusCallbackEvent:  ['completed', 'failed', 'busy', 'no-answer'],

    // Recording: URL fires when the MP3 is ready (not immediately on call end)
    record:                        true,
    recordingStatusCallback:       recordingUrl,
    recordingStatusCallbackMethod: 'POST',

    // Answering Machine Detection — disabled for now to prevent false positives
    // (Twilio AMD can misdetect human speech as voicemail, especially on international lines)
    machineDetection: 'Disable',
  });

  console.log(`[Twilio] Call initiated — SID: ${call.sid}`);

  await prisma.callLog.update({
    where: { id: callLogId },
    data:  { providerRef: call.sid }
  });

  // Return immediately — the telephony-gateway's /call/status webhook handles
  // transcript saving and evaluation queuing when the call ends.
  // fairDispatcher uses this status to mark the job done; actual completion
  // (status=completed, recordingUrl, durationMs) is written by the webhooks.
  return {
    status:       'in-progress',
    callSid:      call.sid,
    recordingUrl: null,
    durationMs:   0
  };
}
