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
  positive: 'bg-green-100 text-green-800 border-green-200',
  neutral:  'bg-zinc-100 text-zinc-800 border-zinc-200',
  negative: 'bg-red-100 text-red-800 border-red-200',
};

const OUTCOME_COLORS = {
  COMPLETED:    'bg-green-100 text-green-800',
  NO_ANSWER:    'bg-amber-100 text-amber-800',
  INCOMPLETE:   'bg-orange-100 text-orange-800',
  WRONG_PERSON: 'bg-red-100 text-red-800',
  RESCHEDULE:   'bg-blue-100 text-blue-800',
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
        // Auto-refresh the report tables if we have new processed calls
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
      <div className="animate-fade-in flex items-center justify-center min-h-[400px] text-muted-foreground">
        Loading campaign report...
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in flex flex-col gap-4">
        <Link to={`/campaigns/${id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium max-w-fit">
          <ArrowLeft size={16} /> Back to Campaign
        </Link>
        <div className="p-6 rounded-xl border border-destructive/20 bg-destructive/5 flex items-center gap-3 text-destructive text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      </div>
    );
  }

  if (!metrics || metrics.totalCalls === 0) {
    return (
      <div className="animate-fade-in flex flex-col gap-4">
        <Link to={`/campaigns/${id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium max-w-fit">
          <ArrowLeft size={16} /> Back to Campaign
        </Link>
        <div className="p-12 rounded-xl border bg-card shadow-sm flex flex-col items-center justify-center text-muted-foreground">
          <BarChart3 size={40} className="mb-3 opacity-20" />
          <p className="font-semibold text-foreground">No Evaluation Data Yet</p>
          <p className="text-sm mt-1">Run AI Evaluation on calls to generate reports.</p>
        </div>
      </div>
    );
  }

  // Build common extracted fields table
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
          <Link to="/" className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 border border-input bg-background hover:bg-zinc-100 transition-colors">
            <ArrowLeft size={16} className="mr-2" /> Back
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Campaign Report</h2>
            <p className="text-muted-foreground text-sm mt-0.5">AI evaluation analytics & extracted data</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <DebouncedSearch 
            onSearch={setSearchQuery} 
            placeholder="Search all tables by contact name..." 
            className="w-72"
          />
          <a
            href={`${EVAL_BASE}/reports/campaign/${id}/export.csv`}
            download
            className="inline-flex items-center gap-2 text-sm font-medium h-9 px-4 rounded-md border border-input bg-background hover:bg-accent transition-colors"
          >
            <Download size={14} /> Export CSV
          </a>
        </div>
      </div>

      {/* ── Progress Bar ── */}
      {progress && progress.total > 0 && (
        <div className={`rounded-xl border p-5 shadow-sm animate-fade-in ${progress.isFinished ? 'border-green-200 bg-green-50' : 'border-primary/20 bg-primary/5'}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm font-semibold flex items-center gap-2 ${progress.isFinished ? 'text-green-700' : 'text-primary'}`}>
              <Activity size={16} className={!progress.isFinished ? "animate-pulse" : ""} /> 
              {progress.isFinished ? 'AI Evaluation Complete' : 'AI Evaluation in Progress...'}
            </h3>
            <span className={`text-xs font-bold px-2 py-1 rounded-md ${progress.isFinished ? 'text-green-800 bg-green-200/50' : 'text-primary bg-primary/10'}`}>
              {progress.completed + progress.failed} / {progress.total} Evaluated
            </span>
          </div>
          <div className={`h-2.5 w-full rounded-full overflow-hidden ${progress.isFinished ? 'bg-green-200' : 'bg-primary/10'}`}>
            <div 
              className={`h-full transition-all duration-500 ease-out rounded-full ${progress.isFinished ? 'bg-green-600' : 'bg-primary'}`} 
              style={{ width: `${((progress.completed + progress.failed) / progress.total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground mt-3 font-semibold uppercase tracking-wider">
            <span className="text-green-600">{progress.completed} Completed</span>
            {progress.failed > 0 && <span className="text-destructive">{progress.failed} Failed</span>}
            {!progress.isFinished && <span className="text-blue-600">{progress.inProgress} Processing</span>}
          </div>
        </div>
      )}

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <Users size={12} className="text-zinc-400" /> Total Evaluated
          </div>
          <div className="text-2xl font-bold tracking-tight">{metrics.totalCalls}</div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <Target size={12} className="text-blue-400" /> Completion Rate
          </div>
          <div className="text-2xl font-bold tracking-tight text-blue-600">{completionPercent}%</div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <TrendingUp size={12} className="text-green-400" /> Avg Score
          </div>
          <div className="text-2xl font-bold tracking-tight text-green-600">{metrics.score?.avg ?? '-'}</div>
          <div className="text-[10px] text-muted-foreground mt-1 flex gap-2">
            <span>High: <strong className="text-foreground">{metrics.score?.max ?? '-'}</strong></span>
            <span>Low: <strong className="text-foreground">{metrics.score?.min ?? '-'}</strong></span>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Sentiment</div>
          <div className="flex flex-col gap-1">
            {Object.entries(metrics.sentimentBreakdown || {}).slice(0, 3).map(([s, count]) => (
              <div key={s} className="flex items-center justify-between leading-tight">
                <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${SENTIMENT_COLORS[s] || SENTIMENT_COLORS.neutral}`}>{s}</span>
                <span className="font-bold text-xs">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Outcome Breakdown ── */}
      {Object.keys(metrics.outcomes || {}).length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm p-4">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-muted-foreground uppercase tracking-tight">
            <Activity size={14} className="text-primary" /> Outcome Breakdown
          </h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(metrics.outcomes).map(([outcome, count]) => (
              <div key={outcome} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold ${OUTCOME_COLORS[outcome] || 'bg-zinc-100 text-zinc-800'}`}>
                {outcome === 'COMPLETED' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                {outcome}: <span className="opacity-80">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {followUpContacts.length > 0 && (
        <FullscreenWrapper
          className="border-amber-200 bg-amber-50/30 max-h-[400px]"
          title={
            <div>
              <span className="font-bold text-amber-900 flex items-center gap-2 text-base">
                <AlertCircle size={18} /> Needs Follow-up / Telephony Issues
              </span>
              <p className="text-xs text-amber-800 mt-0.5 font-normal">Calls that were not completed or requested a reschedule</p>
            </div>
          }
          actionNode={
            <span className="text-xs font-bold bg-amber-200 text-amber-900 px-2 py-1 rounded-md uppercase">
              {followUpContacts.length} Contacts
            </span>
          }
        >
            <table className="w-full text-sm text-left">
              <thead className="bg-amber-100/50 border-b border-amber-200 text-amber-900">
                <tr>
                  <th className="h-10 px-6 font-semibold text-[11px] uppercase tracking-wider">Contact</th>
                  <th className="h-10 px-6 font-semibold text-[11px] uppercase tracking-wider">Issue/Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {followUpContacts.map(c => (
                  <tr key={c.callLogId} className="hover:bg-amber-100/20 transition-colors">
                    <td className="px-6 py-4 font-medium text-amber-900">{c.contactName || 'Unknown'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${OUTCOME_COLORS[c.outcome] || 'bg-zinc-100 text-zinc-800'}`}>
                        {c.outcome}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </FullscreenWrapper>
      )}

      {/* ── Extracted Fields Table (Only Successful) ── */}
      {fieldKeys.length > 0 && (
        <FullscreenWrapper
          className="max-h-[500px]"
          title={
            <div>
              <span className="font-semibold text-base flex items-center gap-2">
                <BarChart3 size={16} className="text-primary" /> Extracted Data Comparison
              </span>
              <p className="text-xs text-muted-foreground mt-1 font-normal">Data successfully extracted from completed calls</p>
            </div>
          }
        >
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="h-10 px-6 font-medium text-xs uppercase tracking-wider">Contact</th>
                  {fieldKeys.map(k => (
                    <th key={k} className="h-10 px-6 font-medium text-xs uppercase tracking-wider">{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {successfulContacts.map(c => (
                  <tr key={c.callLogId} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-medium whitespace-nowrap">{c.contactName || 'Unknown'}</td>
                    {fieldKeys.map(k => {
                      const field = (c.extractedFields || {})[k];
                      const val = field?.value;
                      return (
                        <td key={k} className="px-6 py-3">
                          {val != null ? (
                            <span className="bg-green-50 text-green-800 border border-green-200 px-2 py-0.5 rounded text-xs font-medium">
                              {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic text-xs">-</span>
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

      {/* ── All Results Table ── */}
      <FullscreenWrapper title="Full Call Results" className="max-h-[600px]">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b text-muted-foreground">
              <tr>
                <th className="h-10 px-6 font-medium text-xs uppercase tracking-wider">Contact</th>
                <th className="h-10 px-6 font-medium text-xs uppercase tracking-wider">Outcome</th>
                <th className="h-10 px-6 font-medium text-xs uppercase tracking-wider">Sentiment</th>
                <th className="h-10 px-6 font-medium text-xs uppercase tracking-wider">Score</th>
                <th className="h-10 px-6 font-medium text-xs uppercase tracking-wider">Summary</th>
                <th className="h-10 px-6 font-medium text-xs uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredContacts.map(c => (
                <tr key={c.callLogId} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3 font-medium whitespace-nowrap">{c.contactName || 'Unknown'}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${OUTCOME_COLORS[c.outcome] || 'bg-zinc-100 text-zinc-800'}`}>
                      {c.outcome}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${SENTIMENT_COLORS[c.sentiment] || SENTIMENT_COLORS.neutral}`}>
                      {c.sentiment || '-'}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-bold">{c.score ?? '-'}</td>
                  <td className="px-6 py-3 text-xs text-muted-foreground max-w-[300px] truncate" title={c.reportSummary}>
                    {c.reportSummary || '-'}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <Link
                      to={`/campaign/${id}/calls/${c.callLogId}/report`}
                      className="inline-flex items-center justify-center rounded-md text-xs font-medium h-7 px-3 border border-input bg-background hover:bg-accent transition-colors"
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
