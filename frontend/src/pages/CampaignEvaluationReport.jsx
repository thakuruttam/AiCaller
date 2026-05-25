import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Target, Activity, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { EVAL_BASE } from '../api/config';

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
      <div className="p-6 rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm animate-pulse flex items-center justify-center text-zinc-400 dark:text-slate-500 min-h-[150px]">
        Loading Evaluation Analytics...
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="p-4 rounded-xl border border-red-200 bg-red-50 flex items-center gap-3 text-red-600 text-sm">
        <AlertCircle size={16} /> {error}
      </div>
    );
  }

  if (!report || report.totalCalls === 0) {
    return (
      <div className="p-6 rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex flex-col items-center justify-center text-zinc-400 dark:text-slate-500 min-h-[150px]">
        <BarChart3 size={32} className="mb-2 opacity-20" />
        <p className="text-sm font-medium text-zinc-700 dark:text-slate-300">No Evaluation Data Yet</p>
        <p className="text-xs mt-0.5">Once calls are completed and evaluated, analytics will appear here.</p>
      </div>
    );
  }

  const completionPercent = Math.round((parseFloat(report.completionRate) || 0) * 100);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
      <div className="border-b border-zinc-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
        <h3 className="font-semibold text-base text-zinc-900 dark:text-slate-100 flex items-center gap-2">
          <Activity size={16} className="text-indigo-600" /> Evaluation Analytics
        </h3>
        <a
          href={`${EVAL_BASE}/reports/campaign/${campaignId}/export.csv`}
          download
          className="text-xs font-medium bg-white dark:bg-slate-700 border border-zinc-200 dark:border-slate-600 text-zinc-700 dark:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-slate-700/50 transition-colors shadow-sm"
        >
          Download Full CSV Report
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-zinc-100 dark:divide-slate-700">
        <div className="p-4 flex flex-col gap-1 hover:bg-zinc-50/50 dark:hover:bg-slate-800 transition-colors">
          <div className="text-[10px] font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">Total Evaluated</div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-slate-100">{report.totalCalls}</div>
          <div className="text-[10px] text-zinc-400 dark:text-slate-500">Calls processed by AI</div>
        </div>

        <div className="p-4 flex flex-col gap-1 hover:bg-zinc-50/50 dark:hover:bg-slate-800 transition-colors">
          <div className="text-[10px] font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Target size={11} className="text-blue-500" /> Completion Rate
          </div>
          <div className="text-2xl font-bold text-blue-600">{completionPercent}%</div>
          <div className="text-[10px] text-zinc-400 dark:text-slate-500">Reached end of script</div>
        </div>

        <div className="p-4 flex flex-col gap-1 hover:bg-zinc-50/50 dark:hover:bg-slate-800 transition-colors">
          <div className="text-[10px] font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp size={11} className="text-emerald-500" /> Average AI Score
          </div>
          <div className="text-2xl font-bold text-emerald-600">{report.score?.avg ?? '-'}</div>
          <div className="text-[10px] text-zinc-400 dark:text-slate-500 flex items-center gap-2">
            <span>High: <strong className="text-zinc-700 dark:text-slate-300">{report.score?.max ?? '-'}</strong></span>
            <span>Low: <strong className="text-zinc-700 dark:text-slate-300">{report.score?.min ?? '-'}</strong></span>
          </div>
        </div>

        <div className="p-4 flex flex-col gap-1 hover:bg-zinc-50/50 dark:hover:bg-slate-800 transition-colors">
          <div className="text-[10px] font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">Sentiment</div>
          <div className="flex flex-col gap-1 mt-1">
            {Object.entries(report.sentimentBreakdown || {}).length > 0 ? (
              Object.entries(report.sentimentBreakdown).slice(0, 3).map(([sentiment, count]) => {
                const isPos = sentiment.toLowerCase() === 'positive';
                const isNeg = sentiment.toLowerCase() === 'negative';
                const color = isPos
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700'
                  : isNeg
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
                    : 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600';
                return (
                  <div key={sentiment} className="flex items-center justify-between text-[11px] leading-tight">
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${color}`}>{sentiment}</span>
                    <span className="font-bold text-zinc-900 dark:text-slate-100">{count}</span>
                  </div>
                );
              })
            ) : (
              <span className="text-[11px] text-zinc-400 dark:text-slate-500 italic">No sentiment data</span>
            )}
          </div>
        </div>
      </div>

      {contacts.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-slate-700">
          <div className="px-5 py-3 bg-zinc-50 dark:bg-slate-900 border-b border-zinc-200 dark:border-slate-700 flex justify-between items-center">
            <h4 className="font-semibold text-xs text-zinc-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity size={11} /> Recent Evaluated Calls
            </h4>
            <span className="text-[10px] font-medium text-zinc-500 dark:text-slate-400 bg-white dark:bg-slate-700 px-2 py-0.5 rounded border border-zinc-200 dark:border-slate-600 shadow-sm">
              {contacts.length} / {contactsTotal}
            </span>
          </div>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-900">
                  {['Contact', 'Outcome', 'Sentiment', 'Score', 'Extracted Data', 'Summary'].map(h => (
                    <th key={h} className="px-5 py-3 text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-slate-700">
                {contacts.map((c) => {
                  const extractedEntries = Object.entries(c.extractedFields || {}).filter(([_, v]) => v.value != null);
                  return (
                    <tr key={c.callLogId} className="hover:bg-zinc-50/70 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-5 py-4 font-semibold text-zinc-900 dark:text-slate-100 whitespace-nowrap">{c.contactName || 'Unknown'}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          c.outcome === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-700'
                            : 'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-700'
                        }`}>
                          {c.outcome}
                        </span>
                      </td>
                      <td className="px-5 py-4 capitalize text-zinc-700 dark:text-slate-300 text-sm">{c.sentiment || '-'}</td>
                      <td className="px-5 py-4 font-bold text-zinc-900 dark:text-slate-100">{c.score !== null ? c.score : '-'}</td>
                      <td className="px-5 py-4 text-xs">
                        {extractedEntries.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {extractedEntries.map(([key, val]) => (
                              <span key={key} className="bg-zinc-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-zinc-600 dark:text-slate-400 border border-zinc-200 dark:border-slate-600 text-[10px]">
                                <strong>{key}:</strong> {typeof val.value === 'object' ? '...' : val.value}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-zinc-400 dark:text-slate-500 italic">None</span>}
                      </td>
                      <td className="px-5 py-4 text-xs text-zinc-500 dark:text-slate-400 max-w-[250px] truncate" title={c.reportSummary}>
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
    </div>
  );
}
