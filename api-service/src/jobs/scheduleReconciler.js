// Self-healing safety net for scheduled campaigns. The delayed BullMQ job
// created at schedule time is the fast path that actually fires each call —
// this sweep exists only in case that job is ever lost (e.g. a Redis flush
// or migration between the schedule time and now). It re-attempts enqueueing
// any CallLog still 'scheduled' whose time has arrived; enqueueCall uses
// jobId = callLogId, so BullMQ no-ops if the job is already there — safe to
// run repeatedly.
import { prisma } from '../db.js';
import { enqueueCall } from '../queue/publisher.js';

const SWEEP_INTERVAL_MS = 2 * 60 * 1000;

export function startScheduleReconciler() {
  async function sweep() {
    try {
      const dueCampaigns = await prisma.campaign.findMany({
        where: { scheduledAt: { lte: new Date() } },
        select: { id: true, tenantId: true }
      });

      for (const campaign of dueCampaigns) {
        const logs = await prisma.callLog.findMany({
          where: { campaignId: campaign.id, status: 'scheduled' },
          include: { contact: true }
        });
        for (const log of logs) {
          await enqueueCall(campaign.tenantId, {
            contactId: log.contactId,
            campaignId: campaign.id,
            callLogId: log.id,
            phone: log.contact.phone
          }, { jobId: log.id });
        }
      }
    } catch (err) {
      console.error('[ScheduleReconciler] Sweep error:', err.message);
    }
    setTimeout(sweep, SWEEP_INTERVAL_MS);
  }

  sweep();
}
