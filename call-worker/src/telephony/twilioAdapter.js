import twilio from 'twilio';
import { prisma } from '../db.js';

export async function makeTwilioCall(callData) {
  const { phone, callLogId } = callData;

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromPhone) {
    throw new Error('Twilio credentials (SID, AUTH_TOKEN, PHONE_NUMBER) missing in .env');
  }

  const client = twilio(accountSid, authToken);

  try {
    console.log(`[Twilio] Dialing ${phone} from ${fromPhone}...`);
    
    // 1. Dial the phone number
    const baseUrl = process.env.BASE_URL || 'YOUR_NGROK_URL.ngrok-free.app';
    const streamUrl = `wss://${baseUrl.replace('https://', '').replace('http://', '')}/streams`;

    const twiml = `
        <Response>
          <Say>Connecting you to the AI assistant. One moment.</Say>
          <Connect>
            <Stream url="${streamUrl}">
              <Parameter name="campaignId" value="${callData.campaignId || ''}" />
              <Parameter name="callLogId" value="${callLogId || ''}" />
            </Stream>
          </Connect>
        </Response>`;
    
    console.log(`[Twilio] TwiML: ${twiml}`);

    const call = await client.calls.create({
      record: true,
      twiml,
      to: phone,
      from: fromPhone,
    });

    console.log(`[Twilio] Call successfully initiated! Call SID: ${call.sid}`);
    
    // Save SID immediately for future recording syncs
    await prisma.callLog.update({
      where: { id: callLogId },
      data: { providerRef: call.sid }
    });

    // Because Twilio relies on public webhooks for async call completion (and localhost isn't public),
    // we simulate the delayed return response to Prisma DB for this MVP after 15 seconds.
    return new Promise((resolve) => {
        setTimeout(async () => {
           try {
             // Query Twilio for the raw recording ID
             const recordings = await client.calls(call.sid).recordings.list({limit: 1});
             let recordingUrl = null;
             let dur = 15000;
             if (recordings && recordings.length > 0) {
               const recordingSid = recordings[0].sid;
               // Point the browser exactly to the .mp3 file!
               recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`;
               dur = parseInt(recordings[0].duration || 15) * 1000;
               console.log(`[Twilio] Recording finalized at ${recordingUrl}`);
             }
             
             resolve({
               status: 'completed',
               recordingUrl, 
               durationMs: dur
             });
           } catch (e) {
             console.error("[Twilio] Error fetching the exact recording:", e.message);
             resolve({ status: 'completed', recordingUrl: null, durationMs: 15000 });
           }
        }, 15000);
    });

  } catch (error) {
    console.error(`[Twilio] Error dialing ${phone}`, error.message);
    throw error;
  }
}
