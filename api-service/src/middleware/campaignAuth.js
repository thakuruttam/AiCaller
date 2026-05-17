import { prisma } from '../db.js';

export const verifyCampaignAccess = (idParam = 'id') => async (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  // SUPER_ADMIN and workspace ADMIN have full access
  if (user.role === 'SUPER_ADMIN' || user.workspaceRole === 'ADMIN') {
    return next();
  }

  const campaignId = req.params[idParam];
  if (!campaignId) return next();

  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { createdById: true, tenantId: true }
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.tenantId !== user.workspaceId || campaign.createdById !== user.id) {
      return res.status(403).json({ error: 'Access denied: You do not own this campaign' });
    }

    next();
  } catch (err) {
    console.error('[verifyCampaignAccess]', err);
    res.status(500).json({ error: 'Failed to verify campaign access' });
  }
};

export const verifyCallLogAccess = (idParam = 'id') => async (req, res, next) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  // SUPER_ADMIN and workspace ADMIN have full access
  if (user.role === 'SUPER_ADMIN' || user.workspaceRole === 'ADMIN') {
    return next();
  }

  const callLogId = req.params[idParam];
  if (!callLogId) return next();

  try {
    const callLog = await prisma.callLog.findUnique({
      where: { id: callLogId },
      select: { campaign: { select: { createdById: true, tenantId: true } } }
    });

    if (!callLog) {
      return res.status(404).json({ error: 'Call log not found' });
    }

    if (!callLog.campaign || callLog.campaign.tenantId !== user.workspaceId || callLog.campaign.createdById !== user.id) {
      return res.status(403).json({ error: 'Access denied: You do not own the campaign associated with this call' });
    }

    next();
  } catch (err) {
    console.error('[verifyCallLogAccess]', err);
    res.status(500).json({ error: 'Failed to verify call log access' });
  }
};
