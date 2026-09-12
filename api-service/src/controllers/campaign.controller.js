import { prisma } from '../db.js';
import { publishEvaluation } from '../queue/singletons.js';
import { enqueueCall, removeQueuedCall } from '../queue/publisher.js';
import { hangupPlivoCall, fetchPlivoRecordingUrl } from '../utils/plivoRest.js';
import { notifyWorkspace } from '../utils/notifications.js';

// Returns a valid future Date for a raw scheduledAt input, or null if it's
// missing/unparseable/in the past — callers treat null as "launch immediately".
function parseFutureSchedule(scheduledAt) {
  if (!scheduledAt) return null;
  const date = new Date(scheduledAt);
  if (isNaN(date.getTime()) || date.getTime() <= Date.now()) return null;
  return date;
}

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
      contacts, scheduledAt
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
    const createdCallLogs = [];
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

        const callLog = await prisma.callLog.create({
          data: {
             tenantId,
             contactId: contact.id,
             campaignId: campaign.id,
             status: 'draft'
          }
        });

        createdContacts.push(contact);
        createdCallLogs.push({ contact, callLog });
      }
    }

    // A future scheduledAt means this campaign should dial itself
    // automatically at that time — no separate manual "Start" click needed.
    // CallLogs go straight to 'scheduled' and each gets its own delayed
    // BullMQ job (jobId = callLogId, so the reconciliation sweep can safely
    // re-attempt this without ever double-booking a call).
    const scheduleDate = parseFutureSchedule(scheduledAt);
    if (scheduleDate) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { scheduledAt: scheduleDate }
      });
      const delay = scheduleDate.getTime() - Date.now();
      for (const { contact, callLog } of createdCallLogs) {
        await prisma.callLog.update({ where: { id: callLog.id }, data: { status: 'scheduled' } });
        await enqueueCall(tenantId, {
          contactId: contact.id,
          campaignId: campaign.id,
          callLogId: callLog.id,
          phone: contact.phone
        }, { delay, jobId: callLog.id });
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
      contacts, scheduledAt
    } = req.body;

    const maxCallDurationSec = Math.max(30, (callSettings?.maxDuration || 5) * 60);
    const scheduleDate = parseFutureSchedule(scheduledAt);

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
        scheduledAt: scheduleDate,
      }
    });

    // Contacts must be scoped to the campaign's own tenant, not the editing
    // user's currently-active workspace — a SUPER_ADMIN editing a campaign
    // that belongs to a different tenant than the one their session has
    // active would otherwise create/link contacts under the wrong tenant.
    const tenantId = campaign.tenantId;

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

    // 4. Cleanup old contacts that were removed from the wizard.
    // Not gated on validContactIds.length — `notIn: []` correctly matches every
    // row, which is exactly right when the user removed their last contact and
    // the wizard submitted an empty contacts list.
    {
      // Delete ghost draft call logs (never attempted — safe to discard outright).
      await prisma.callLog.deleteMany({
        where: {
          campaignId: id,
          contactId: { notIn: validContactIds },
          status: 'draft'
        }
      });
      // Remove the contact from this campaign's active list. CallLog rows are
      // keyed by campaignId+contactId directly (not through CampaignContact),
      // and call reports/evaluations are queried by campaignId on CallReport —
      // neither depends on this row existing, so removing it never touches
      // historical call/report data. Previously this was skipped for contacts
      // with any non-draft call log, which meant a contact could never be
      // removed from a campaign again once a single real call had been placed.
      await prisma.campaignContact.deleteMany({
        where: {
          campaignId: id,
          contactId: { notIn: validContactIds }
        }
      });
    }

    // 5. Reconcile scheduling. Only touches CallLogs that haven't actually
    // been started yet ('draft' = never scheduled, 'scheduled' = an earlier
    // save already set a delayed job for this campaign) — never disturbs a
    // campaign a user has already clicked Start on.
    {
      const unstartedLogs = await prisma.callLog.findMany({
        where: { campaignId: id, status: { in: ['draft', 'scheduled'] } },
        include: { contact: true }
      });

      if (scheduleDate) {
        const delay = scheduleDate.getTime() - Date.now();
        for (const log of unstartedLogs) {
          // Remove any previously-scheduled job for this log first — BullMQ
          // won't update an existing job's delay if we just re-add the same
          // jobId, so a changed schedule time would otherwise be silently
          // ignored and the call would fire at the OLD time.
          await removeQueuedCall(tenantId, log.id);
          await prisma.callLog.update({ where: { id: log.id }, data: { status: 'scheduled' } });
          await enqueueCall(tenantId, {
            contactId: log.contactId,
            campaignId: id,
            callLogId: log.id,
            phone: log.contact.phone
          }, { delay, jobId: log.id });
        }
      } else {
        // Schedule was cleared (or never set) — cancel any pending delayed
        // jobs and drop previously-'scheduled' logs back to 'draft' so they
        // wait for a manual Start again, instead of firing unexpectedly.
        for (const log of unstartedLogs) {
          if (log.status === 'scheduled') {
            await removeQueuedCall(tenantId, log.id);
            await prisma.callLog.update({ where: { id: log.id }, data: { status: 'draft' } });
          }
        }
      }
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

// Duplicates only what a creator entered in the wizard (name, type, goal/intro/
// sign-off, questions, end-call rule, scoring rules, call settings) into a brand
// new campaign — no contacts, no call logs, no evaluation/report data. Lands the
// clone in the same empty-but-configured state a freshly created campaign is in,
// ready for the wizard's Contacts step before it can be started.
export const cloneCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const source = await prisma.campaign.findUnique({
      where: { id },
      include: { callModule: true }
    });

    if (!source) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Belongs to the SOURCE campaign's tenant, not the cloning SUPER_ADMIN's
    // currently-active workspace — same reasoning as campaign contact edits.
    const tenantId = source.tenantId;

    const callModule = await prisma.callModule.create({
      data: {
        name: `${source.name} (Copy) Script`,
        prompt: source.callModule?.prompt || '',
        goal: source.callModule?.goal || null,
        callIntro: source.callModule?.callIntro || null,
        callSignOff: source.callModule?.callSignOff || null,
        courtesyClose: source.callModule?.courtesyClose || false,
        successCriteria: source.callModule?.successCriteria || null,
        tenantId
      }
    });

    const clone = await prisma.campaign.create({
      data: {
        name: `${source.name} (Copy)`,
        type: source.type,
        dataToCollect: source.dataToCollect ?? [],
        endCallIf: source.endCallIf,
        rules: source.rules ?? {},
        callSettings: source.callSettings ?? {},
        maxCallDurationSec: source.maxCallDurationSec,
        tenantId,
        callModuleId: callModule.id,
        createdById: req.user.id
      }
    });

    notifyWorkspace({
      tenantId,
      type: 'CAMPAIGN_CREATED',
      title: `Campaign cloned: ${clone.name}`,
      body: 'Cloned from an existing campaign — add contacts and start when ready.',
      link: `/edit-campaign/${clone.id}`
    });

    res.status(201).json({ campaign: clone });
  } catch (error) {
    console.error('[cloneCampaign]', error);
    res.status(500).json(dbErrorPayload(error));
  }
};

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

       // Cancel any not-yet-fired scheduled/delayed jobs so they don't dial
       // after this campaign has already been killed.
       const scheduledLogs = await prisma.callLog.findMany({
         where: { campaignId: id, status: 'scheduled' }
       });
       if (scheduledLogs.length > 0 && campaign) {
         await Promise.allSettled(scheduledLogs.map(log => removeQueuedCall(campaign.tenantId, log.id)));
       }

       await prisma.callLog.updateMany({
         where: { campaignId: id, status: { in: ['queued', 'paused', 'draft', 'in-progress', 'scheduled'] } },
         data: { status: 'cancelled' }
       });
    } else if (action === 'pause') {
       // Pausing a scheduled campaign cancels its pending delayed jobs —
       // resuming re-queues immediately rather than at the original time.
       const scheduledLogs = await prisma.callLog.findMany({
         where: { campaignId: id, status: 'scheduled' }
       });
       if (scheduledLogs.length > 0 && campaign) {
         await Promise.allSettled(scheduledLogs.map(log => removeQueuedCall(campaign.tenantId, log.id)));
       }

       await prisma.callLog.updateMany({
         where: { campaignId: id, status: { in: ['queued', 'scheduled'] } },
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
        rerun:  { type: 'CAMPAIGN_RERUN',    title: `Campaign re-run: ${campaign.name}`,   body: 'All contacts re-queued for a fresh call; previous recordings and transcripts were kept.' },
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

// ONE-OFF ADMIN MIGRATION — remove after use. Merges duplicate Contact rows
// (same tenantId+phone) created by the pre-fix non-atomic find-or-create race
// in createWizardCampaign/updateWizardCampaign. Reassigns call logs and
// campaign links to a single surviving contact per phone number, then deletes
// the redundant ones — required before Contact(tenantId, phone) can carry a
// unique index, since Mongo will reject building it over existing duplicates.
export const debugDuplicateContacts = async (req, res) => {
  try {
    const phones = ['+918059859242', '+918887098336'];
    const contacts = await prisma.contact.findMany({ where: { phone: { in: phones } } });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const mergeDuplicateContacts = async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany();
    const groups = new Map();
    for (const c of contacts) {
      const key = `${c.tenantId}|${c.phone}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    const dupGroups = [...groups.values()].filter(g => g.length > 1);

    const summary = [];
    for (const group of dupGroups) {
      const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
      const primary = sorted[0];
      const duplicates = sorted.slice(1);

      for (const dup of duplicates) {
        await prisma.callLog.updateMany({
          where: { contactId: dup.id },
          data: { contactId: primary.id }
        });

        const dupCCs = await prisma.campaignContact.findMany({ where: { contactId: dup.id } });
        for (const cc of dupCCs) {
          const existingPrimaryCC = await prisma.campaignContact.findFirst({
            where: { campaignId: cc.campaignId, contactId: primary.id }
          });
          if (existingPrimaryCC) {
            await prisma.campaignContact.delete({ where: { id: cc.id } });
          } else {
            await prisma.campaignContact.update({ where: { id: cc.id }, data: { contactId: primary.id } });
          }
        }

        await prisma.contact.delete({ where: { id: dup.id } });
      }

      summary.push({
        tenantId: primary.tenantId,
        phone: primary.phone,
        primaryId: primary.id,
        mergedIds: duplicates.map(d => d.id)
      });
    }

    res.json({ mergedGroups: summary.length, summary });
  } catch (error) {
    console.error('[mergeDuplicateContacts]', error);
    res.status(500).json({ error: error.message });
  }
};

// Same 10 voices the Realtime API accepts for live calls (telephony-gateway's
// providers/openaiRealtime.js) — kept in sync manually since they live in
// different services. marin/cedar are OpenAI's newest and most natural-sounding.
const REALTIME_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];

/**
 * Generate a short spoken sample of a given voice so users can compare voices
 * while building a campaign, before committing to one. Uses OpenAI's separate,
 * synchronous /v1/audio/speech endpoint (gpt-4o-mini-tts) — a different, much
 * cheaper API than the Realtime sessions live calls use, purely for previewing.
 * The OpenAI key stays server-side; only the resulting audio bytes go back.
 */
export const previewVoice = async (req, res) => {
  try {
    const { voice, text } = req.body || {};
    if (!voice || !REALTIME_VOICES.includes(voice)) {
      return res.status(400).json({ error: `voice must be one of: ${REALTIME_VOICES.join(', ')}` });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
    }

    const sampleText = (text && text.trim())
      ? text.trim().slice(0, 500) // previews are meant to be short samples, not the full call script
      : 'Hi, this is an automated call. This is a quick preview of how this voice sounds.';

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice,
        input: sampleText,
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[previewVoice] OpenAI TTS error:', response.status, errText);
      return res.status(502).json({ error: 'Failed to generate voice preview.' });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (error) {
    console.error('[previewVoice]', error);
    res.status(500).json({ error: error?.message || 'Unknown error' });
  }
};
