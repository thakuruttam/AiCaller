import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import api from '../api/axios';
import {
  ArrowLeft, BarChart3, TrendingUp, Target, Activity,
  AlertCircle, Users, CheckCircle2, XCircle, Download, Phone
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import DebouncedSearch from '../components/DebouncedSearch';
import FullscreenWrapper from '../components/FullscreenWrapper';

import { EVAL_BASE } from '../api/config';

const SENTIMENT_COLORS = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
  neutral:  'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
  negative: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
};

const OUTCOME_COLORS = {
  COMPLETED:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  NO_ANSWER:    'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  INCOMPLETE:   'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  WRONG_PERSON: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  RESCHEDULE:   'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

export default function CampaignReport() {
  const { id } = useParams();
  const { addToast } = useToast();
  const [metrics, setMetrics] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [progress, setProgress] = useState(null);

  const fetchData = async () => {
    try {
      const [resMetrics, resContacts] = await Promise.all([
        axios.get(`${EVAL_BASE}/reports/campaign/${id}`),
        axios.get(`${EVAL_BASE}/reports/campaign/${id}/contacts?limit=100`)
      ]);
      setMetrics(resMetrics.data);
      setContacts(resContacts.data.contacts || []);
      setError(null);
    } catch (err) {
      setError('Could not load report. Make sure the evaluation service is running on port 4000.');
    }
  };

  useEffect(() => {
    let intervalId;
    let lastProcessed = -1;

    const init = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };

    const pollProgress = async () => {
      try {
        const res = await axios.get(`${EVAL_BASE}/reports/campaign/${id}/progress`);
        setProgress(res.data);
        const currentProcessed = res.data.completed + res.data.failed;
        if (currentProcessed > lastProcessed && lastProcessed !== -1) {
          await fetchData();
        }
        lastProcessed = currentProcessed;
        if (res.data.isFinished || res.data.total === 0) {
          clearInterval(intervalId);
        }
      } catch (e) {
        console.error(e);
      }
    };

    init().then(() => {
      pollProgress();
      intervalId = setInterval(pollProgress, 2000);
    });

    return () => clearInterval(intervalId);
  }, [id]);

  if (loading) {
    return (
      <div className="animate-fade-in flex items-center justify-center min-h-[400px] text-zinc-500 dark:text-slate-400">
        Loading campaign report...
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in flex flex-col gap-4">
        <Link to={`/campaigns/${id}`} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-100 transition-colors max-w-fit">
          <ArrowLeft size={14} /> Back to Campaign
        </Link>
        <div className="p-5 rounded-xl border border-red-200 bg-red-50 flex items-center gap-3 text-red-600 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      </div>
    );
  }

  if (!metrics || metrics.totalCalls === 0) {
    return (
      <div className="animate-fade-in flex flex-col gap-4">
        <Link to={`/campaigns/${id}`} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-100 transition-colors max-w-fit">
          <ArrowLeft size={14} /> Back to Campaign
        </Link>
        <div className="p-12 rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm flex flex-col items-center justify-center text-zinc-400 dark:text-slate-500">
          <BarChart3 size={40} className="mb-3 opacity-20" />
          <p className="font-semibold text-zinc-700 dark:text-slate-300">No Evaluation Data Yet</p>
          <p className="text-sm mt-1">Run AI Evaluation on calls to generate reports.</p>
        </div>
      </div>
    );
  }

  const allFieldKeys = new Set();
  contacts.forEach(c => {
    Object.keys(c.extractedFields || {}).forEach(k => {
      if ((c.extractedFields[k])?.value != null) allFieldKeys.add(k);
    });
  });
  const fieldKeys = Array.from(allFieldKeys);
  const completionPercent = Math.round((parseFloat(metrics.completionRate) || 0) * 100);

  const filteredContacts = contacts.filter(c => {
    if (!searchQuery) return true;
    return (c.contactName || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const followUpContacts = filteredContacts.filter(c => ['NO_ANSWER', 'WRONG_PERSON', 'INCOMPLETE', 'RESCHEDULE'].includes(c.outcome));
  const successfulContacts = filteredContacts.filter(c => c.outcome === 'COMPLETED');

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-100 transition-colors">
            <ArrowLeft size={14} /> Back
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-slate-100 tracking-tight">Campaign Report</h2>
            <p className="text-zinc-500 dark:text-slate-400 text-sm mt-0.5">AI evaluation analytics & extracted data</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DebouncedSearch
            onSearch={setSearchQuery}
            placeholder="Search by contact name..."
            className="w-72"
          />
          <a
            href={`${EVAL_BASE}/reports/campaign/${id}/export.csv`}
            download
            className="inline-flex items-center gap-2 text-sm font-medium h-9 px-4 rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-zinc-50 dark:hover:bg-slate-700/50 active:bg-zinc-100 text-zinc-700 dark:text-slate-300 transition-colors"
          >
            <Download size={14} /> Export CSV
          </a>
        </div>
      </div>

      {/* Progress Bar */}
      {progress && progress.total > 0 && (
        <div className={`rounded-2xl border p-5 shadow-sm animate-fade-in ring-1 ring-black/[0.02] ${progress.isFinished ? 'border-emerald-200 bg-emerald-50' : 'border-indigo-200 bg-indigo-50'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm font-semibold flex items-center gap-2 ${progress.isFinished ? 'text-emerald-700' : 'text-indigo-700'}`}>
              <Activity size={15} className={!progress.isFinished ? "animate-pulse" : ""} />
              {progress.isFinished ? 'AI Evaluation Complete' : 'AI Evaluation in Progress...'}
            </h3>
            <span className={`text-xs font-bold px-2 py-1 rounded-md ${progress.isFinished ? 'text-emerald-800 bg-emerald-200/60' : 'text-indigo-800 bg-indigo-200/60'}`}>
              {progress.completed + progress.failed} / {progress.total} Evaluated
            </span>
          </div>
          <div className={`h-2.5 w-full rounded-full overflow-hidden ${progress.isFinished ? 'bg-emerald-200' : 'bg-indigo-200'}`}>
            <div
              className={`h-full transition-all duration-500 ease-out rounded-full ${progress.isFinished ? 'bg-emerald-600' : 'bg-indigo-600'}`}
              style={{ width: `${((progress.completed + progress.failed) / progress.total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] mt-3 font-semibold uppercase tracking-wider">
            <span className="text-emerald-600">{progress.completed} Completed</span>
            {progress.failed > 0 && <span className="text-red-600">{progress.failed} Failed</span>}
            {!progress.isFinished && <span className="text-blue-600">{progress.inProgress} Processing</span>}
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, iconBg: 'bg-zinc-100 dark:bg-slate-700', iconColor: 'text-zinc-500 dark:text-slate-400', label: 'Total Evaluated', value: metrics.totalCalls },
          { icon: Target, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', label: 'Completion Rate', value: `${completionPercent}%`, valueClass: 'text-blue-600' },
          { icon: TrendingUp, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', label: 'Avg Score', value: metrics.score?.avg ?? '-', valueClass: 'text-emerald-600' },
        ].map(({ icon: Icon, iconBg, iconColor, label, value, valueClass }) => (
          <div key={label} className="bg-white dark:bg-slate-800 rounded-2xl border border-zinc-200/80 dark:border-slate-700 p-5 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.05]">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-500 dark:text-slate-400">{label}</p>
                <p className={`mt-2 text-3xl font-bold tabular-nums tracking-tight ${valueClass || 'text-zinc-900 dark:text-slate-100'}`}>{value}</p>
              </div>
              <div className={`ml-3 rounded-xl p-2.5 ${iconBg}`}>
                <Icon size={18} className={iconColor} />
              </div>
            </div>
          </div>
        ))}
        {/* Sentiment card */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-zinc-200/80 dark:border-slate-700 p-5 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.05]">
          <p className="text-sm font-medium text-zinc-500 dark:text-slate-400 mb-3">Sentiment</p>
          <div className="flex flex-col gap-1.5">
            {Object.entries(metrics.sentimentBreakdown || {}).slice(0, 3).map(([s, count]) => (
              <div key={s} className="flex items-center justify-between leading-tight">
                <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold capitalize ${SENTIMENT_COLORS[s] || SENTIMENT_COLORS.neutral}`}>{s}</span>
                <span className="font-bold text-zinc-900 dark:text-slate-100 text-sm tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Outcome Breakdown */}
      {Object.keys(metrics.outcomes || {}).length > 0 && (
        <div className="rounded-2xl border border-zinc-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.05] p-5">
          <h3 className="font-semibold text-xs text-zinc-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity size={13} className="text-indigo-600" /> Outcome Breakdown
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(metrics.outcomes).map(([outcome, count]) => (
              <div key={outcome} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${OUTCOME_COLORS[outcome] || 'bg-zinc-100 text-zinc-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                {outcome === 'COMPLETED' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                {outcome}: <span className="opacity-80">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {followUpContacts.length > 0 && (
        <FullscreenWrapper
          className="border-amber-200 max-h-[400px]"
          title={
            <div>
              <span className="font-bold text-amber-800 flex items-center gap-2 text-sm">
                <AlertCircle size={15} /> Needs Follow-up / Telephony Issues
              </span>
              <p className="text-xs text-amber-700 mt-0.5 font-normal">Calls that were not completed or requested a reschedule</p>
            </div>
          }
          actionNode={
            <span className="text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1 rounded-md">
              {followUpContacts.length} Contacts
            </span>
          }
        >
          <table className="w-full text-sm text-left">
            <thead className="bg-amber-50 border-b border-amber-200">
              <tr>
                <th className="px-5 py-3 text-xs font-semibold text-amber-800 uppercase tracking-wider">Contact</th>
                <th className="px-5 py-3 text-xs font-semibold text-amber-800 uppercase tracking-wider">Issue / Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {followUpContacts.map(c => (
                <tr key={c.callLogId} className="hover:bg-amber-50/50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-amber-900">{c.contactName || 'Unknown'}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${OUTCOME_COLORS[c.outcome] || 'bg-zinc-100 text-zinc-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                      {c.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </FullscreenWrapper>
      )}

      {fieldKeys.length > 0 && (
        <FullscreenWrapper
          className="max-h-[500px]"
          title={
            <div>
              <span className="font-semibold text-sm text-zinc-900 dark:text-slate-100 flex items-center gap-2">
                <BarChart3 size={14} className="text-indigo-600" /> Extracted Data Comparison
              </span>
              <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5 font-normal">Data successfully extracted from completed calls</p>
            </div>
          }
        >
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 dark:bg-slate-900 border-b border-zinc-200 dark:border-slate-700">
              <tr>
                <th className="px-5 py-3 text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">Contact</th>
                {fieldKeys.map(k => (
                  <th key={k} className="px-5 py-3 text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-slate-700">
              {successfulContacts.map(c => (
                <tr key={c.callLogId} className="hover:bg-zinc-50/70 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-5 py-3 font-semibold text-zinc-900 dark:text-slate-100 whitespace-nowrap">{c.contactName || 'Unknown'}</td>
                  {fieldKeys.map(k => {
                    const field = (c.extractedFields || {})[k];
                    const val = field?.value;
                    return (
                      <td key={k} className="px-5 py-3">
                        {val != null ? (
                          <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 px-2 py-0.5 rounded text-xs font-medium">
                            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                          </span>
                        ) : (
                          <span className="text-zinc-400 dark:text-slate-500 italic text-xs">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </FullscreenWrapper>
      )}

      {/* Full Call Results */}
      <FullscreenWrapper title="Full Call Results" className="max-h-[600px]">
        <table className="w-full text-sm text-left">
          <thead className="bg-zinc-50 dark:bg-slate-900 border-b border-zinc-200 dark:border-slate-700">
            <tr>
              {['Contact', 'Outcome', 'Sentiment', 'Score', 'Summary', ''].map(h => (
                <th key={h} className={`px-5 py-3 text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider ${h === '' ? 'text-right' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-slate-700">
            {filteredContacts.map(c => (
              <tr key={c.callLogId} className="hover:bg-zinc-50/70 dark:hover:bg-slate-700/50 transition-colors">
                <td className="px-5 py-3 font-semibold text-zinc-900 dark:text-slate-100 whitespace-nowrap">{c.contactName || 'Unknown'}</td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${OUTCOME_COLORS[c.outcome] || 'bg-zinc-100 text-zinc-700 dark:bg-slate-700 dark:text-slate-300'}`}>
                    {c.outcome}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${SENTIMENT_COLORS[c.sentiment] || SENTIMENT_COLORS.neutral}`}>
                    {c.sentiment || '-'}
                  </span>
                </td>
                <td className="px-5 py-3 font-bold text-zinc-900 dark:text-slate-100">{c.score ?? '-'}</td>
                <td className="px-5 py-3 text-xs text-zinc-500 dark:text-slate-400 max-w-[300px] truncate" title={c.reportSummary}>
                  {c.reportSummary || '-'}
                </td>
                <td className="px-5 py-3 text-right">
                  <Link
                    to={`/campaign/${id}/calls/${c.callLogId}/report`}
                    className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50 shadow-sm transition-colors"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </FullscreenWrapper>
    </div>
  );
}
