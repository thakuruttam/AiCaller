import { prisma } from '../db.js';
import { publishEvaluation } from '../queue/singletons.js';
import { enqueueCall } from '../queue/publisher.js';
import { hangupPlivoCall, fetchPlivoRecordingUrl } from '../utils/plivoRest.js';
import { notifyWorkspace } from '../utils/notifications.js';

function dbErrorPayload(error) {
  const unreachable =
    error?.code === 'ECONNREFUSED' ||
    error?.code === 'ENOTFOUND' ||
    error?.code === 'P1001' ||
    /connection refused|server selection timeout/i.test(error?.message || '');
  if (unreachable) {
    return {
      error:
        'Cannot connect to MongoDB. Start the database (e.g. `docker compose up -d mongo` from the project root) and ensure DATABASE_URL in backend/.env matches.',
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
        },
        callLogs: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Tenant isolation — SUPER_ADMIN can access any campaign
    if (req.user.role !== 'SUPER_ADMIN' && campaign.tenantId !== req.user.workspaceId) {
      return res.status(403).json({ error: 'Access denied' });
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

    const maxCallDurationSec = Math.max(30, (callSettings?.maxDuration || 5) * 60);

    const campaign = await prisma.campaign.create({
      data: {
        name: name || 'Untitled Campaign',
        type: type || 'HR',
        dataToCollect: dataToCollect || [],
        endCallIf:     endCallIf     || null,
        rules:         rules         || {},
        callSettings:  callSettings  || {},
        maxCallDurationSec,
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

    // Calculate and store estimated total minutes
    const estimatedTotalMinutes = createdContacts.reduce((sum, _, i) => {
      const c = contacts[i];
      const effectiveSec = c?.overrides?.maxCallDurationSec || maxCallDurationSec;
      return sum + Math.ceil(effectiveSec / 60);
    }, 0);
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { estimatedTotalMinutes }
    });

    notifyWorkspace({
      tenantId,
      type: 'CAMPAIGN_CREATED',
      title: `Campaign created: ${campaign.name}`,
      body: `A new campaign with ${createdContacts.length} contact${createdContacts.length !== 1 ? 's' : ''} was created.`,
      link: `/campaigns/${campaign.id}`
    });

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

    const maxCallDurationSec = Math.max(30, (callSettings?.maxDuration || 5) * 60);

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
        maxCallDurationSec,
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

    // Recalculate estimated total minutes based on current contacts and their overrides
    if (contacts && contacts.length > 0) {
      const updatedCCs = await prisma.campaignContact.findMany({
        where: { campaignId: id },
        select: { overrides: true }
      });
      const estimatedTotalMinutes = updatedCCs.reduce((sum, cc) => {
        const effectiveSec = cc.overrides?.maxCallDurationSec || maxCallDurationSec;
        return sum + Math.ceil(effectiveSec / 60);
      }, 0);
      await prisma.campaign.update({
        where: { id },
        data: { estimatedTotalMinutes }
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
    const allTenants = user.role === 'SUPER_ADMIN' && req.query.all === 'true';

    const filter = allTenants ? {} : { tenantId: user.workspaceId };

    // Non-admins can only see campaigns they created within their tenant
    if (!allTenants && user.role !== 'SUPER_ADMIN' && user.workspaceRole !== 'ADMIN') {
      filter.createdById = user.id;
    }

    const campaigns = await prisma.campaign.findMany({
      where: filter,
      include: {
        tenant: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        campaignContacts: {
          include: { contact: true }
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

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { name: true, tenantId: true }
    });

    if (action === 'kill') {
       // Cancel any active Plivo calls before updating DB
       const inProgressLogs = await prisma.callLog.findMany({
         where: { campaignId: id, status: 'in-progress' }
       });

       if (inProgressLogs.length > 0 && process.env.PLIVO_AUTH_ID) {
         await Promise.allSettled(
           inProgressLogs
             .filter(log => log.providerRef)
             .map(log => hangupPlivoCall(log.providerRef))
         );
       }

       await prisma.callLog.updateMany({
         where: { campaignId: id, status: { in: ['queued', 'paused', 'draft', 'in-progress'] } },
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
       // 1. Delete only non-terminal logs — keep completed/failed for billing history
       await prisma.callLog.deleteMany({
         where: {
           campaignId: id,
           status: { notIn: ['completed', 'failed', 'no-answer', 'busy'] }
         }
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
    
    if (campaign) {
      const notifMap = {
        start:  { type: 'CAMPAIGN_STARTED',  title: `Campaign started: ${campaign.name}`,  body: 'The campaign is now running.' },
        resume: { type: 'CAMPAIGN_STARTED',  title: `Campaign resumed: ${campaign.name}`,  body: 'The campaign has resumed.' },
        pause:  { type: 'CAMPAIGN_PAUSED',   title: `Campaign paused: ${campaign.name}`,   body: 'The campaign has been paused.' },
        kill:   { type: 'CAMPAIGN_KILLED',   title: `Campaign stopped: ${campaign.name}`,  body: 'The campaign was stopped and all queued calls cancelled.' },
        rerun:  { type: 'CAMPAIGN_RERUN',    title: `Campaign re-run: ${campaign.name}`,   body: 'All previous logs cleared and calls re-queued.' },
      };
      const notif = notifMap[action];
      if (notif) {
        notifyWorkspace({
          tenantId: campaign.tenantId,
          type: notif.type,
          title: notif.title,
          body: notif.body,
          link: `/campaigns/${id}`
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

export const fetchRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const callLog = await prisma.callLog.findUnique({ where: { id }});
    if (!callLog) return res.status(404).json({error: "Call log not found"});

    // Usually already populated by telephony-gateway's /call/recording webhook
    // once Plivo's recording is ready — only poll Plivo directly as a fallback.
    if (callLog.recordingUrl) return res.json(callLog);

    const callUuid = callLog.providerRef;
    if (!callUuid) {
       return res.status(400).json({
         error: "No Plivo call UUID found for this call.",
         details: "Ensure the call was successfully initiated and the UUID was captured."
       });
    }

    const recordingUrl = await fetchPlivoRecordingUrl(callUuid);
    if (recordingUrl) {
       const updatedLog = await prisma.callLog.update({
         where: { id },
         data: { recordingUrl }
       });
       return res.json(updatedLog);
    } else {
       return res.status(404).json({error: "Recording not available yet. Try again later."});
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
