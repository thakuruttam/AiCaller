import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Target, Activity, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { EVAL_BASE } from '../api/config';
import FullscreenTable, { FullscreenButton } from '../components/FullscreenTable';

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
      <div className="p-6 rounded-card border border-paper-500 dark:border-ink-400 bg-paper-100 dark:bg-ink-200 shadow-card animate-pulse flex items-center justify-center text-ink-800 dark:text-ink-800 min-h-[150px]">
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
      <div className="p-6 rounded-card border border-paper-500 dark:border-ink-400 bg-paper-100 dark:bg-ink-200 shadow-card flex flex-col items-center justify-center text-ink-800 dark:text-ink-800 min-h-[150px]">
        <BarChart3 size={32} className="mb-2 opacity-20" />
        <p className="text-sm font-medium text-ink-500 dark:text-ink-900">No Evaluation Data Yet</p>
        <p className="text-xs mt-0.5">Once calls are completed and evaluated, analytics will appear here.</p>
      </div>
    );
  }

  const completionPercent = Math.round((parseFloat(report.completionRate) || 0) * 100);

  return (
    <FullscreenTable className="rounded-card border border-paper-500 dark:border-ink-400 bg-paper-100 dark:bg-ink-200 shadow-card overflow-hidden">
      {({ toggle, isFs }) => (<>
      <div className="border-b border-paper-500 dark:border-ink-400 px-6 py-4 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-ink-100 dark:text-paper-200 flex items-center gap-2">
          <Activity size={16} className="text-brand-500" /> Evaluation Analytics
        </h3>
        <div className="flex items-center gap-2">
          <a
            href={`${EVAL_BASE}/reports/campaign/${campaignId}/export.csv`}
            download
            className="text-xs font-medium bg-paper-100 dark:bg-ink-300 border border-paper-500 dark:border-ink-400 text-ink-500 dark:text-ink-900 px-3 py-1.5 rounded-control hover:bg-paper-200 dark:hover:bg-ink-400/50 transition-colors shadow-card"
          >
            Download Full CSV Report
          </a>
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
              Object.entries(report.sentimentBreakdown).slice(0, 3).map(([sentiment, count]) => {
                const isPos = sentiment.toLowerCase() === 'positive';
                const isNeg = sentiment.toLowerCase() === 'negative';
                const color = isPos
                  ? 'bg-positive/10 text-positive-dim border-positive/30 dark:bg-positive/15 dark:text-positive dark:border-positive/15'
                  : isNeg
                    ? 'bg-negative/10 text-negative-dim border-negative/30 dark:bg-negative/15 dark:text-negative dark:border-negative/15'
                    : 'bg-paper-400 text-ink-500 border-paper-500 dark:bg-ink-300 dark:text-ink-900 dark:border-ink-400';
                return (
                  <div key={sentiment} className="flex items-center justify-between text-xs leading-tight">
                    <span className={`px-1.5 py-0.5 rounded border text-xs font-medium uppercase ${color}`}>{sentiment}</span>
                    <span className="font-bold text-ink-100 dark:text-paper-200">{count}</span>
                  </div>
                );
              })
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
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-paper-500 dark:border-ink-400 bg-paper-200 dark:bg-ink-50">
                  {['Contact', 'Outcome', 'Sentiment', 'Score', 'Extracted Data', 'Summary'].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-medium text-ink-700 dark:text-ink-900 ">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-400 dark:divide-ink-400">
                {contacts.map((c) => {
                  const extractedEntries = Object.entries(c.extractedFields || {}).filter(([, v]) => v.value != null);
                  return (
                    <tr key={c.callLogId} className="hover:bg-paper-200/70 dark:hover:bg-ink-400/50 transition-colors">
                      <td className="px-7 py-5 font-semibold text-ink-100 dark:text-paper-200 whitespace-nowrap">{c.contactName || 'Unknown'}</td>
                      <td className="px-7 py-5">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          c.outcome === 'COMPLETED'
                            ? 'bg-positive/10 text-positive-dim ring-1 ring-positive dark:bg-positive/15 dark:text-positive dark:ring-positive/15'
                            : 'bg-negative/10 text-negative-dim ring-1 ring-negative dark:bg-negative/15 dark:text-negative dark:ring-negative/15'
                        }`}>
                          {c.outcome}
                        </span>
                      </td>
                      <td className="px-7 py-5 capitalize text-ink-500 dark:text-ink-900 text-sm">{c.sentiment || '-'}</td>
                      <td className="px-7 py-5 font-bold text-ink-100 dark:text-paper-200">{c.score !== null ? c.score : '-'}</td>
                      <td className="px-7 py-5 text-xs">
                        {extractedEntries.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {extractedEntries.map(([key, val]) => (
                              <span key={key} className="bg-paper-400 dark:bg-ink-300 px-1.5 py-0.5 rounded text-ink-600 dark:text-ink-900 border border-paper-500 dark:border-ink-400 text-xs">
                                <strong>{key}:</strong> {typeof val.value === 'object' ? '...' : val.value}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-ink-800 dark:text-ink-800 italic">None</span>}
                      </td>
                      <td className="px-7 py-5 text-xs text-ink-700 dark:text-ink-900 max-w-[250px] truncate" title={c.reportSummary}>
                        {c.reportSummary || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>)}
    </FullscreenTable>
  );
}
