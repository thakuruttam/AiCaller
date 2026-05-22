import { prisma } from '../db.js';
import { publishEvaluation } from '../queue/singletons.js';
import { enqueueCall } from '../queue/publisher.js';

function dbErrorPayload(error) {
  if (error?.code === 'ECONNREFUSED' || error?.code === 'ENOTFOUND') {
    return {
      error:
        'Cannot connect to PostgreSQL. Start the database (e.g. `docker compose up -d postgres` from the project root) and ensure DATABASE_URL in backend/.env matches.',
      code: error.code,
    };
  }
  return { error: error?.message || 'Unknown error', code: error?.code };
}

export const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        callModule: true,
        campaignContacts: {
          include: {
            contact: true
          }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(campaign);
  } catch (error) {
    console.error('[getCampaignById]', error);
    res.status(500).json(dbErrorPayload(error));
  }
};

export const createWizardCampaign = async (req, res) => {
  try {
    const { 
      name, type, 
      prompt, goals, 
      dataToCollect, endCallIf, rules, callSettings, 
      contacts 
    } = req.body;

    // Use the authenticated user's workspace and identity
    const tenantId   = req.user.workspaceId;   // JWT key: workspaceId
    const createdById = req.user.id;           // JWT key: id

    if (!tenantId) {
      return res.status(400).json({ error: 'No active workspace found for this user.' });
    }

    const callModule = await prisma.callModule.create({
      data: {
        name: `${name || 'Wizard'} Script`,
        prompt: prompt || '',
        // Keep structured fields as primary metadata
        goal:          goals?.goal          || null,
        callIntro:     goals?.callIntro     || null,
        callSignOff:   goals?.callSignOff   || null,
        tenantId
      }
    });

    const campaign = await prisma.campaign.create({
      data: {
        name: name || 'Untitled Campaign',
        type: type || 'HR',
        dataToCollect: dataToCollect || [],
        endCallIf:     endCallIf     || null,
        rules:         rules         || {},
        callSettings:  callSettings  || {},
        tenantId,
        callModuleId: callModule.id,
        createdById
      }
    });

    const createdContacts = [];
    if (contacts && contacts.length > 0) {
      // Deduplicate contacts by phone number to prevent calling the same person multiple times concurrently
      const uniqueContacts = Array.from(new Map(contacts.map(c => [c.phone, c])).values());
      for (const c of uniqueContacts) {
        let contact = await prisma.contact.findFirst({ where: { phone: c.phone, tenantId } });
        if (!contact) {
          contact = await prisma.contact.create({
             data: { name: c.name, phone: c.phone, tenantId }
          });
        }
        
        await prisma.campaignContact.create({
          data: {
            campaignId: campaign.id,
            contactId: contact.id,
            overrides: { ...(c.overrides || {}), name: c.name }
          }
        });
        
        await prisma.callLog.create({
          data: {
             tenantId,
             contactId: contact.id,
             campaignId: campaign.id,
             status: 'draft'
          }
        });

        createdContacts.push(contact);
      }
    }

    res.status(201).json({ campaign, contactsCreated: createdContacts.length });
  } catch (error) {
    console.error('[createWizardCampaign]', error);
    res.status(500).json(dbErrorPayload(error));
  }
};

export const updateWizardCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, type, 
      prompt, goals, 
      dataToCollect, endCallIf, rules, callSettings, 
      contacts 
    } = req.body;

    const tenantId = req.user.workspaceId;

    // 1. Update Campaign
    const campaign = await prisma.campaign.update({
      where: { id },
      data: {
        name: name,
        type: type,
        dataToCollect: dataToCollect || [],
        endCallIf:     endCallIf     || null,
        rules:         rules         || {},
        callSettings:  callSettings  || {},
      }
    });

    // 2. Update Call Module
    await prisma.callModule.update({
      where: { id: campaign.callModuleId },
      data: {
        name: `${name || 'Wizard'} Script`,
        prompt: prompt || '',
        goal:          goals?.goal          || null,
        callIntro:     goals?.callIntro     || null,
        callSignOff:   goals?.callSignOff   || null,
      }
    });

    // 3. Sync Contacts (Addition and Override Update)
    const validContactIds = [];
    if (contacts && contacts.length > 0) {
      // Deduplicate contacts by phone number
      const uniqueContacts = Array.from(new Map(contacts.map(c => [c.phone, c])).values());
      for (const c of uniqueContacts) {
        let contact = await prisma.contact.findFirst({ where: { phone: c.phone, tenantId } });
        if (!contact) {
          contact = await prisma.contact.create({
            data: { name: c.name, phone: c.phone, tenantId }
          });
        }
        validContactIds.push(contact.id);

        // Check if already in campaign
        const existingCCs = await prisma.campaignContact.findMany({
          where: { campaignId: id, contactId: contact.id },
          orderBy: { id: 'asc' }
        });

        if (existingCCs.length > 0) {
          await prisma.campaignContact.update({
            where: { id: existingCCs[0].id },
            data: { overrides: { ...(c.overrides || {}), name: c.name } }
          });
          
          // Delete any duplicates for this contact
          if (existingCCs.length > 1) {
             const duplicateIds = existingCCs.slice(1).map(cc => cc.id);
             await prisma.campaignContact.deleteMany({
                where: { id: { in: duplicateIds } }
             });
          }
        } else {
          await prisma.campaignContact.create({
            data: {
              campaignId: id,
              contactId: contact.id,
              overrides: { ...(c.overrides || {}), name: c.name }
            }
          });
          
          await prisma.callLog.create({
            data: {
              tenantId,
              contactId: contact.id,
              campaignId: id,
              status: 'draft'
            }
          });
        }
      }
    }

    // 4. Cleanup old contacts that were removed from the wizard (only safe for drafts)
    if (validContactIds.length > 0) {
      // Delete ghost draft call logs
      await prisma.callLog.deleteMany({
        where: {
          campaignId: id,
          contactId: { notIn: validContactIds },
          status: 'draft'
        }
      });
      // Delete ghost campaign contacts if they don't have non-draft call logs
      const activeLogs = await prisma.callLog.findMany({
        where: { campaignId: id, contactId: { notIn: validContactIds }, status: { not: 'draft' } }
      });
      const activeContactIds = activeLogs.map(l => l.contactId);
      await prisma.campaignContact.deleteMany({
        where: {
          campaignId: id,
          contactId: { notIn: [...validContactIds, ...activeContactIds] }
        }
      });
    }

    res.json({ message: 'Campaign updated successfully', campaign });
  } catch (error) {
    console.error('[updateWizardCampaign]', error);
    res.status(500).json(dbErrorPayload(error));
  }
};

export const uploadContacts = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { contacts } = req.body; 
    
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }});
    if(!campaign) return res.status(404).json({error: 'Campaign not found'});

    const createdContacts = [];

    // Deduplicate contacts by phone number
    const uniqueContacts = Array.from(new Map(contacts.map(c => [c.phone, c])).values());

    // Create contacts and enqueue calls
    for (const c of uniqueContacts) {
      let contact = await prisma.contact.findFirst({ where: { phone: c.phone, tenantId: campaign.tenantId } });
      if (!contact) {
        contact = await prisma.contact.create({
          data: {
            name: c.name,
            phone: c.phone,
            tenantId: campaign.tenantId
          }
        });
      }
      
      await prisma.campaignContact.create({
         data: {
           campaignId: campaign.id,
           contactId: contact.id,
           overrides: { ...(c.overrides || {}), name: c.name }
         }
      });
      createdContacts.push(contact);

      const callLog = await prisma.callLog.create({
        data: {
          tenantId: campaign.tenantId,
          contactId: contact.id,
          campaignId: campaign.id,
          status: 'queued'
        }
      });

      await enqueueCall(campaign.tenantId, {
        contactId: contact.id,
        campaignId: campaign.id,
        callLogId: callLog.id,
        phone: contact.phone
      });
    }

    res.status(200).json({ message: `Added ${createdContacts.length} contacts and queued calls.`, contacts: createdContacts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCampaigns = async (req, res) => {
  try {
    const user = req.user;
    const filter = { tenantId: user.workspaceId };
    
    // Non-admins can only see their own campaigns
    if (user.role !== 'SUPER_ADMIN' && user.workspaceRole !== 'ADMIN') {
      filter.createdById = user.id;
    }

    const campaigns = await prisma.campaign.findMany({
      where: filter,
      include: {
        campaignContacts: {
          include: {
            contact: true
          }
        },
        callLogs: {
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(campaigns);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const updateCampaignStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; 

    if (action === 'kill') {
       await prisma.callLog.updateMany({
         where: { campaignId: id, status: { in: ['queued', 'paused', 'draft'] } },
         data: { status: 'cancelled' }
       });
    } else if (action === 'pause') {
       await prisma.callLog.updateMany({
         where: { campaignId: id, status: 'queued' },
         data: { status: 'paused' }
       });
    } else if (action === 'start' || action === 'resume') {
       const initialStatus = action === 'start' ? 'draft' : 'paused';
       await prisma.callLog.updateMany({
         where: { campaignId: id, status: initialStatus },
         data: { status: 'queued' }
       });

       const logsToQueue = await prisma.callLog.findMany({ 
         where: { campaignId: id, status: 'queued' }, 
         include: { contact: true } 
       });

       for (const log of logsToQueue) {
          await enqueueCall(log.tenantId, {
             contactId: log.contactId,
             campaignId: id,
             callLogId: log.id,
             phone: log.contact.phone
          });
       }
    } else if (action === 'rerun') {
       // 1. Delete all existing logs for this campaign (replaces older data)
       await prisma.callLog.deleteMany({
         where: { campaignId: id }
       });

       // 2. Fetch all contacts assigned to this campaign
       const campaignContacts = await prisma.campaignContact.findMany({
         where: { campaignId: id },
         include: { contact: true }
       });

       // 3. Create fresh logs and queue them
       for (const cc of campaignContacts) {
          const newLog = await prisma.callLog.create({
            data: {
              tenantId: cc.contact.tenantId,
              contactId: cc.contactId,
              campaignId: id,
              status: 'queued'
            }
          });

          await enqueueCall(cc.contact.tenantId, {
            contactId: cc.contactId,
            campaignId: id,
            callLogId: newLog.id,
            phone: cc.contact.phone
          });
       }
    }
    
    res.json({ message: `Campaign ${action} executed successfully.` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getCallDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const callLog = await prisma.callLog.findUnique({
      where: { id },
      include: { 
        contact: true,
        campaign: true
      }
    });
    if(!callLog) return res.status(404).json({error: "Call log not found"});
    res.json(callLog);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

import twilio from 'twilio';

export const fetchRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const callLog = await prisma.callLog.findUnique({ where: { id }});
    if (!callLog) return res.status(404).json({error: "Call log not found"});
    
    // Prioritize the dedicated providerRef field, fallback to transcript hack for legacy logs
    let callSid = callLog.providerRef;
    
    if (!callSid) {
      const match = callLog.transcript?.match(/\[Twilio_SID:(CA[a-zA-Z0-9]+)\]/);
      if (match) {
        callSid = match[1];
      }
    }

    if (!callSid) {
       return res.status(400).json({
         error: "No Twilio Call SID found for this call.",
         details: "Ensure the call was successfully initiated and the SID was captured."
       });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = twilio(accountSid, authToken);

    const recordings = await client.calls(callSid).recordings.list({limit: 1});
    if (recordings && recordings.length > 0) {
       const recordingSid = recordings[0].sid;
       const recordingUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Recordings/${recordingSid}.mp3`;
       
       const updatedLog = await prisma.callLog.update({
         where: { id },
         data: { recordingUrl }
       });
       return res.json(updatedLog);
    } else {
       return res.status(404).json({error: "Recording not available in Twilio yet. Try again later."});
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}


export const reevaluateCall = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch the call log with its campaign and contact
    const callLog = await prisma.callLog.findUnique({
      where: { id },
      include: {
        campaign: true,
        contact: true
      }
    });

    if (!callLog) {
      return res.status(404).json({ error: "Call log not found" });
    }

    if (!callLog.transcript) {
      return res.status(400).json({ error: "This call does not have a transcript to evaluate." });
    }

    const { campaign, contact } = callLog;
    const campaignContact = await prisma.campaignContact.findFirst({
      where: { campaignId: campaign.id, contactId: contact.id }
    });
    const contactName = campaignContact?.overrides?.name || contact?.name || 'Unknown Contact';

    // Send payload to evaluation service via singleton queue
    await publishEvaluation({
      callLogId:        callLog.id,
      campaignId:       campaign.id,
      tenantId:         campaign.tenantId,
      contactName,
      transcript:       callLog.transcript || null,
      campaignName:     campaign.name,
      dataToCollect:    campaign.dataToCollect ?? [],
      reportWebhook:    campaign.callSettings?.reportWebhook ?? null
    }, 10); // priority 10 = manual re-evaluate

    res.json({ message: "Evaluation queued", callLogId: callLog.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const recallCall = async (req, res) => {
  try {
    const { id, callLogId } = req.params;
    
    // Find the original call log
    const originalLog = await prisma.callLog.findUnique({
      where: { id: callLogId },
      include: {
        campaign: true,
        contact: true
      }
    });

    if (!originalLog) {
      return res.status(404).json({ error: "Call log not found" });
    }

    const { campaign, contact } = originalLog;

    if (!contact?.phone) {
      return res.status(400).json({ error: "Contact has no phone number" });
    }

    // Create a new REAL queued call log
    const newCallLog = await prisma.callLog.create({
      data: {
        tenantId: originalLog.tenantId,
        contactId: originalLog.contactId,
        campaignId: originalLog.campaignId,
        status: 'queued'
      }
    });

    // Push to actual telephony queue
    await enqueueCall(originalLog.tenantId, {
      callLogId: newCallLog.id,
      phone:     contact.phone,
      contactId: contact.id,
      campaignId: campaign.id
    });

    res.json({ message: "Outbound re-call queued successfully", newCallLogId: newCallLog.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
