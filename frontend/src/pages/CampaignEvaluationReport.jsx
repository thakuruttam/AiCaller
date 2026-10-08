import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Target, Activity, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { EVAL_BASE } from '../api/config';
import FullscreenTable, { FullscreenButton } from '../components/FullscreenTable';
import {
  Button, Badge, toneForStatus, statusLabel,
  Table, THead, TBody, Th, Tr, Td,
} from '../components/ui';

// Sentiment isn't a call status, so it gets its own tone map rather than being
// forced through `toneForStatus`.
const SENTIMENT_TONE = { positive: 'positive', negative: 'negative', neutral: 'neutral' };

export default function CampaignEvaluationReport({ campaignId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [contactsTotal, setContactsTotal] = useState(0);

  useEffect(() => {
    if (!campaignId) return;

    const fetchReport = async () => {
      try {
        setLoading(true);
        const [resMetrics, resContacts] = await Promise.all([
          axios.get(`${EVAL_BASE}/reports/campaign/${campaignId}`),
          axios.get(`${EVAL_BASE}/reports/campaign/${campaignId}/contacts?limit=50`)
        ]);
        setReport(resMetrics.data);
        setContacts(resContacts.data.contacts || []);
        setContactsTotal(resContacts.data.total || 0);
        setError(null);
      } catch (err) {
        console.error("Failed to load evaluation report", err);
        setError("Evaluation report not available or service is offline.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
    const interval = setInterval(fetchReport, 15000);
    return () => clearInterval(interval);
  }, [campaignId]);

  if (loading && !report) {
    return (
      <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-6 animate-pulse flex items-center justify-center text-ink-800 dark:text-ink-800 min-h-[150px]">
        Loading Evaluation Analytics...
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="p-4 rounded-card border border-negative/30 bg-negative/10 flex items-center gap-3 text-negative-dim text-sm">
        <AlertCircle size={16} /> {error}
      </div>
    );
  }

  if (!report || report.totalCalls === 0) {
    return (
      <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-6 flex flex-col items-center justify-center text-ink-800 dark:text-ink-800 min-h-[150px]">
        <BarChart3 size={32} className="mb-2 opacity-20" />
        <p className="text-sm font-medium text-ink-500 dark:text-ink-900">No Evaluation Data Yet</p>
        <p className="text-xs mt-0.5">Once calls are completed and evaluated, analytics will appear here.</p>
      </div>
    );
  }

  const completionPercent = Math.round((parseFloat(report.completionRate) || 0) * 100);

  return (
    <FullscreenTable className="bg-card dark:bg-muted rounded-2xl shadow-primary overflow-hidden">
      {({ toggle, isFs }) => (<>
      <div className="border-b border-paper-500 dark:border-ink-400 px-6 py-4 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-ink-100 dark:text-paper-200 flex items-center gap-2">
          <Activity size={16} className="text-brand-500" /> Evaluation Analytics
        </h3>
        <div className="flex items-center gap-2">
          <Button
            as="a"
            variant="secondary"
            size="sm"
            icon="download"
            href={`${EVAL_BASE}/reports/campaign/${campaignId}/export.csv`}
            download
          >
            Download CSV
          </Button>
          <FullscreenButton toggle={toggle} isFs={isFs} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-paper-400 dark:divide-ink-400">
        <div className="p-4 flex flex-col gap-1 hover:bg-paper-200/50 dark:hover:bg-ink-300 transition-colors">
          <div className="text-xs font-medium text-ink-700 dark:text-ink-900 ">Total Evaluated</div>
          <div className="text-2xl font-bold text-ink-100 dark:text-paper-200">{report.totalCalls}</div>
          <div className="text-xs text-ink-800 dark:text-ink-800">Calls processed by AI</div>
        </div>

        <div className="p-4 flex flex-col gap-1 hover:bg-paper-200/50 dark:hover:bg-ink-300 transition-colors">
          <div className="text-xs font-medium text-ink-700 dark:text-ink-900 flex items-center gap-1.5">
            <Target size={11} className="text-brand-500" /> Completion Rate
          </div>
          <div className="text-2xl font-bold text-brand-500">{completionPercent}%</div>
          <div className="text-xs text-ink-800 dark:text-ink-800">Reached end of script</div>
        </div>

        <div className="p-4 flex flex-col gap-1 hover:bg-paper-200/50 dark:hover:bg-ink-300 transition-colors">
          <div className="text-xs font-medium text-ink-700 dark:text-ink-900 flex items-center gap-1.5">
            <TrendingUp size={11} className="text-positive" /> Average AI Score
          </div>
          <div className="text-2xl font-bold text-positive-dim">{report.score?.avg ?? '-'}</div>
          <div className="text-xs text-ink-800 dark:text-ink-800 flex items-center gap-2">
            <span>High: <strong className="text-ink-500 dark:text-ink-900">{report.score?.max ?? '-'}</strong></span>
            <span>Low: <strong className="text-ink-500 dark:text-ink-900">{report.score?.min ?? '-'}</strong></span>
          </div>
        </div>

        <div className="p-4 flex flex-col gap-1 hover:bg-paper-200/50 dark:hover:bg-ink-300 transition-colors">
          <div className="text-xs font-medium text-ink-700 dark:text-ink-900 ">Sentiment</div>
          <div className="flex flex-col gap-1 mt-1">
            {Object.entries(report.sentimentBreakdown || {}).length > 0 ? (
              Object.entries(report.sentimentBreakdown).slice(0, 3).map(([sentiment, count]) => (
                <div key={sentiment} className="flex items-center justify-between gap-2 leading-tight">
                  <Badge tone={SENTIMENT_TONE[sentiment.toLowerCase()] || 'neutral'}>{sentiment}</Badge>
                  <span className="text-sm font-semibold text-ink-100 dark:text-paper-200">{count}</span>
                </div>
              ))
            ) : (
              <span className="text-xs text-ink-800 dark:text-ink-800 italic">No sentiment data</span>
            )}
          </div>
        </div>
      </div>

      {contacts.length > 0 && (
        <div className="border-t border-paper-500 dark:border-ink-400">
          <div className="px-5 py-3 bg-paper-200 dark:bg-ink-50 border-b border-paper-500 dark:border-ink-400 flex justify-between items-center">
            <h4 className="font-medium text-xs text-ink-700 dark:text-ink-900 flex items-center gap-1.5">
              <Activity size={11} /> Recent Evaluated Calls
            </h4>
            <span className="text-xs font-medium text-ink-700 dark:text-ink-900 bg-paper-100 dark:bg-ink-300 px-2 py-0.5 rounded border border-paper-500 dark:border-ink-400 shadow-card">
              {contacts.length} / {contactsTotal}
            </span>
          </div>
          <div className="overflow-auto max-h-[400px]">
            <Table>
              <THead>
                <Th icon="person">Contact</Th>
                <Th icon="flag">Outcome</Th>
                <Th icon="mood">Sentiment</Th>
                <Th icon="target" align="right">Score</Th>
                <Th icon="data_object">Extracted data</Th>
                <Th icon="notes">Summary</Th>
              </THead>
              <TBody>
                {contacts.map((c) => {
                  const extractedEntries = Object.entries(c.extractedFields || {}).filter(([, v]) => v.value != null);
                  return (
                    <Tr key={c.callLogId}>
                      <Td className="font-medium whitespace-nowrap">{c.contactName || 'Unknown'}</Td>
                      <Td>
                        <Badge tone={toneForStatus(c.outcome)}>{statusLabel(c.outcome)}</Badge>
                      </Td>
                      <Td>
                        {c.sentiment
                          ? <Badge tone={SENTIMENT_TONE[String(c.sentiment).toLowerCase()] || 'neutral'}>{c.sentiment}</Badge>
                          : <span className="text-ink-800">—</span>}
                      </Td>
                      <Td align="right" className="font-semibold">{c.score !== null ? c.score : '—'}</Td>
                      <Td>
                        {extractedEntries.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[220px]">
                            {extractedEntries.map(([key, val]) => (
                              <Badge key={key} dot={false} capitalize={false}>
                                <span className="text-ink-800 dark:text-ink-800">{key}</span>
                                <span className="text-ink-100 dark:text-paper-200">
                                  {typeof val.value === 'object' ? '…' : String(val.value)}
                                </span>
                              </Badge>
                            ))}
                          </div>
                        ) : <span className="text-ink-800">None</span>}
                      </Td>
                      <Td className="text-ink-600 dark:text-ink-900 max-w-[260px] truncate" title={c.reportSummary}>
                        {c.reportSummary || '—'}
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </div>
      )}
      </>)}
    </FullscreenTable>
  );
}
