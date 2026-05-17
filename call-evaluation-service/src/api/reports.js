// src/api/reports.js — GET /reports/* endpoints
import { Router } from 'express';
import { prisma } from '../db.js';

export const reportsRouter = Router();

// Single call report
reportsRouter.get('/call/:callLogId', async (req, res) => {
  try {
    const report = await prisma.callReport.findUnique({
      where: { callLogId: req.params.callLogId }
    });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json(report);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Campaign aggregate stats
reportsRouter.get('/campaign/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const [total, outcomes, avgScore, sentiments] = await Promise.all([
      prisma.callReport.count({ where: { campaignId } }),
      prisma.callReport.groupBy({
        by: ['outcome'],
        where: { campaignId },
        _count: { outcome: true }
      }),
      prisma.callReport.aggregate({
        where: { campaignId, score: { not: null } },
        _avg: { score: true },
        _max: { score: true },
        _min: { score: true }
      }),
      prisma.callReport.groupBy({
        by: ['sentiment'],
        where: { campaignId },
        _count: { sentiment: true }
      })
    ]);

    const completedCount = outcomes.find(o => o.outcome === 'COMPLETED')?._count?.outcome ?? 0;

    res.json({
      campaignId,
      totalCalls:        total,
      completionRate:    total > 0 ? (completedCount / total).toFixed(2) : 0,
      outcomes:          Object.fromEntries(outcomes.map(o => [o.outcome, o._count.outcome])),
      score: {
        avg: avgScore._avg.score ? Math.round(avgScore._avg.score) : null,
        max: avgScore._max.score,
        min: avgScore._min.score
      },
      sentimentBreakdown: Object.fromEntries(sentiments.map(s => [s.sentiment, s._count.sentiment]))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Global evaluation progress tracking (for Dashboard)
reportsRouter.get('/progress/global', async (req, res) => {
  try {
    const jobs = await prisma.reportJob.findMany({
      select: {
        ingestStatus: true,
        normalizeStatus: true,
        extractStatus: true,
        evaluateStatus: true,
        complianceStatus: true,
        assembleStatus: true
      }
    });

    const total = jobs.length;
    let completed = 0;
    let failed = 0;
    let inProgress = 0;

    for (const job of jobs) {
      if (
        job.ingestStatus === 'failed' || job.normalizeStatus === 'failed' ||
        job.extractStatus === 'failed' || job.evaluateStatus === 'failed' ||
        job.complianceStatus === 'failed' || job.assembleStatus === 'failed'
      ) {
        failed++;
      } else if (job.assembleStatus === 'done') {
        completed++;
      } else {
        inProgress++;
      }
    }

    res.json({
      total,
      completed,
      failed,
      inProgress
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Campaign evaluation progress tracking
reportsRouter.get('/campaign/:campaignId/progress', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    // Fetch all report jobs linked to this campaign
    const jobs = await prisma.reportJob.findMany({
      where: { report: { campaignId } },
      select: {
        ingestStatus: true,
        normalizeStatus: true,
        extractStatus: true,
        evaluateStatus: true,
        complianceStatus: true,
        assembleStatus: true
      }
    });

    const total = jobs.length;
    let completed = 0;
    let failed = 0;
    let inProgress = 0;

    for (const job of jobs) {
      if (
        job.ingestStatus === 'failed' || job.normalizeStatus === 'failed' ||
        job.extractStatus === 'failed' || job.evaluateStatus === 'failed' ||
        job.complianceStatus === 'failed' || job.assembleStatus === 'failed'
      ) {
        failed++;
      } else if (job.assembleStatus === 'done') {
        completed++;
      } else {
        inProgress++;
      }
    }

    res.json({
      total,
      completed,
      failed,
      inProgress,
      isFinished: total > 0 && (completed + failed === total)
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Per-contact paginated table with filters
reportsRouter.get('/campaign/:campaignId/contacts', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { outcome, sentiment, score_gte, score_lte, page = '1', limit = '20' } = req.query;

    const where = {
      campaignId,
      ...(outcome   && { outcome }),
      ...(sentiment && { sentiment }),
      ...((score_gte || score_lte) && {
        score: {
          ...(score_gte && { gte: parseInt(score_gte) }),
          ...(score_lte && { lte: parseInt(score_lte) })
        }
      })
    };

    const [contacts, total] = await Promise.all([
      prisma.callReport.findMany({
        where,
        select: {
          callLogId: true, contactName: true, outcome: true,
          failureReason: true, sentiment: true, score: true,
          reportSummary: true, completionRate: true, createdAt: true, extractedFields: true
        },
        orderBy: { createdAt: 'desc' },
        skip:  (parseInt(page) - 1) * parseInt(limit),
        take:  parseInt(limit)
      }),
      prisma.callReport.count({ where })
    ]);

    res.json({ contacts, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// CSV export
reportsRouter.get('/campaign/:campaignId/export.csv', async (req, res) => {
  try {
    const reports = await prisma.callReport.findMany({
      where: { campaignId: req.params.campaignId },
      select: {
        callLogId: true, contactName: true, outcome: true, failureReason: true,
        sentiment: true, score: true, completionRate: true, reportSummary: true,
        missingFields: true, createdAt: true, extractedFields: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Collect all dynamic extraction keys across all reports
    const dynamicKeys = new Set();
    reports.forEach(r => {
      const extracted = r.extractedFields || {};
      Object.keys(extracted).forEach(k => dynamicKeys.add(k));
    });
    const extractionCols = Array.from(dynamicKeys);

    const baseHeader = 'callLogId,contactName,outcome,failureReason,sentiment,score,completionRate,summary,missingFields,date';
    const header = [baseHeader, ...extractionCols].join(',');

    const rows = reports.map(r => {
      const extracted = r.extractedFields || {};
      const extractionVals = extractionCols.map(k => {
        const val = extracted[k]?.value;
        if (val == null) return '""';
        const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${strVal.replace(/"/g, '""')}"`;
      });

      const baseRow = [
        r.callLogId, r.contactName, r.outcome, r.failureReason ?? '',
        r.sentiment, r.score ?? '', r.completionRate ?? '',
        `"${(r.reportSummary ?? '').replace(/"/g, '""')}"`,
        `"${JSON.stringify(r.missingFields ?? [])}"`,
        r.createdAt.toISOString()
      ];

      return [...baseRow, ...extractionVals].join(',');
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${req.params.campaignId}.csv"`);
    res.send([header, ...rows].join('\n'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
