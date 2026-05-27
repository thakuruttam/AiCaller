import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import DebouncedSearch from '../components/DebouncedSearch';
import { EVAL_BASE } from '../api/config';

const SENTIMENT_ICON = {
  positive: { icon: 'sentiment_satisfied', color: 'text-emerald-500' },
  neutral:  { icon: 'sentiment_neutral', color: 'text-zinc-400' },
  negative: { icon: 'sentiment_dissatisfied', color: 'text-[#ba1a1a]' },
};

const OUTCOME_BADGE = {
  COMPLETED:    'bg-emerald-50 text-emerald-700',
  NO_ANSWER:    'bg-zinc-100 text-zinc-600',
  INCOMPLETE:   'bg-amber-50 text-amber-700',
  WRONG_PERSON: 'bg-[#ffdad6] text-[#ba1a1a]',
  RESCHEDULE:   'bg-blue-50 text-blue-700',
  BUSY:         'bg-zinc-100 text-zinc-600',
  FAILED:       'bg-[#ffdad6] text-[#ba1a1a]',
};

const OUTCOME_FILTER_KEYS = ['All', 'COMPLETED', 'NO_ANSWER', 'BUSY', 'INCOMPLETE', 'FAILED', 'WRONG_PERSON', 'RESCHEDULE'];

export default function CampaignReport() {
  const { id } = useParams();
  const { addToast } = useToast();
  const [metrics, setMetrics] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [progress, setProgress] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

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

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#777587]">Loading campaign report...</div>
  );

  if (error) return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <Link to={`/campaigns/${id}`} className="flex items-center gap-2 text-[#464555] hover:text-[#3525cd] transition-colors text-sm mb-6" style={{fontFamily:'JetBrains Mono, monospace'}}>
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Campaign Details
      </Link>
      <div className="p-5 rounded-xl border border-[#ffdad6] bg-[#ffdad6]/30 flex items-center gap-3 text-[#ba1a1a] text-sm">
        <span className="material-symbols-outlined">error</span>
        {error}
      </div>
    </div>
  );

  if (!metrics || metrics.totalCalls === 0) return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <Link to={`/campaigns/${id}`} className="flex items-center gap-2 text-[#464555] hover:text-[#3525cd] transition-colors text-sm mb-6" style={{fontFamily:'JetBrains Mono, monospace'}}>
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Campaign Details
      </Link>
      <div className="p-12 rounded-xl border border-zinc-200 bg-white flex flex-col items-center justify-center text-zinc-400">
        <span className="material-symbols-outlined text-[48px] mb-3 opacity-20">bar_chart</span>
        <p className="font-semibold text-zinc-700">No Evaluation Data Yet</p>
        <p className="text-sm mt-1">Run AI Evaluation on calls to generate reports.</p>
      </div>
    </div>
  );

  const completionPercent = Math.round((parseFloat(metrics.completionRate) || 0) * 100);
  const avgScore = metrics.score?.avg ?? '—';
  const sentiment = metrics.sentimentBreakdown || {};
  const total = metrics.totalCalls || 0;
  const posCount = sentiment.positive || 0;
  const neuCount = sentiment.neutral || 0;
  const negCount = sentiment.negative || 0;

  const filteredContacts = contacts.filter(c => {
    const matchSearch = !searchQuery || (c.contactName || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchFilter = activeFilter === 'All' || c.outcome === activeFilter;
    return matchSearch && matchFilter;
  });

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / PER_PAGE));
  const paginated = filteredContacts.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const outcomeCounts = contacts.reduce((acc, c) => {
    acc[c.outcome] = (acc[c.outcome] || 0) + 1;
    return acc;
  }, {});

  const progressPct = progress && progress.total > 0
    ? Math.round(((progress.completed + progress.failed) / progress.total) * 100)
    : 0;

  return (
    <div className="p-8 max-w-[1200px] mx-auto space-y-8">
      {/* Page Header */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <Link to={`/campaigns/${id}`} className="flex items-center gap-2 text-[#464555] hover:text-[#3525cd] transition-colors text-sm mb-3" style={{fontFamily:'JetBrains Mono, monospace'}}>
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Campaign Details
            </Link>
            <h2 className="text-3xl font-semibold text-[#1b1b24] tracking-tight mb-1">Campaign Performance Report</h2>
            <p className="text-[#464555]">AI evaluation analytics &amp; extracted data</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`${EVAL_BASE}/reports/campaign/${id}/export.csv`}
              download
              className="flex items-center gap-2 px-4 py-2 border border-zinc-300 text-[#1b1b24] text-sm rounded hover:bg-zinc-50 transition-all"
              style={{fontFamily:'JetBrains Mono, monospace'}}
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Export CSV
            </a>
            {progress && progress.total > 0 && (
              <div className="bg-[#e4e1ee] p-4 rounded-xl min-w-[280px]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-[#1b1b24]" style={{fontFamily:'JetBrains Mono, monospace'}}>AI Evaluation Progress</span>
                  <span className="text-xs text-[#3525cd]" style={{fontFamily:'JetBrains Mono, monospace'}}>
                    {progress.completed + progress.failed} / {progress.total} Evaluated
                  </span>
                </div>
                <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#3525cd] h-full transition-all duration-1000"
                    style={{width: `${progressPct}%`}}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-zinc-200/80 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-[#3525cd]/10 text-[#3525cd] rounded-lg">
              <span className="material-symbols-outlined">task_alt</span>
            </span>
          </div>
          <p className="text-[#464555] text-sm mb-1" style={{fontFamily:'JetBrains Mono, monospace'}}>Total Evaluated</p>
          <h3 className="text-2xl font-semibold text-[#1b1b24]">{total.toLocaleString()}</h3>
        </div>

        <div className="bg-white border border-zinc-200/80 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-[#dae2fd]/30 text-[#565e74] rounded-lg">
              <span className="material-symbols-outlined">percent</span>
            </span>
          </div>
          <p className="text-[#464555] text-sm mb-1" style={{fontFamily:'JetBrains Mono, monospace'}}>Completion Rate</p>
          <h3 className="text-2xl font-semibold text-[#3525cd]">{completionPercent}%</h3>
        </div>

        <div className="bg-white border border-zinc-200/80 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <span className="material-symbols-outlined" style={{fontVariationSettings:"'FILL' 1"}}>star</span>
            </span>
          </div>
          <p className="text-[#464555] text-sm mb-1" style={{fontFamily:'JetBrains Mono, monospace'}}>Avg Score</p>
          <h3 className="text-2xl font-semibold text-emerald-700">{avgScore} / 100</h3>
        </div>

        <div className="bg-white border border-zinc-200/80 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[#464555] text-sm mb-4" style={{fontFamily:'JetBrains Mono, monospace'}}>Sentiment Breakdown</p>
          <div className="flex flex-wrap gap-2">
            {posCount > 0 && (
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs flex items-center gap-1" style={{fontFamily:'JetBrains Mono, monospace'}}>
                <span className="w-1.5 h-1.5 bg-emerald-700 rounded-full" />
                {Math.round((posCount / total) * 100)}% Pos
              </span>
            )}
            {neuCount > 0 && (
              <span className="px-3 py-1 bg-zinc-100 text-zinc-700 rounded-full text-xs flex items-center gap-1" style={{fontFamily:'JetBrains Mono, monospace'}}>
                <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full" />
                {Math.round((neuCount / total) * 100)}% Neu
              </span>
            )}
            {negCount > 0 && (
              <span className="px-3 py-1 bg-[#ffdad6] text-[#ba1a1a] rounded-full text-xs flex items-center gap-1" style={{fontFamily:'JetBrains Mono, monospace'}}>
                <span className="w-1.5 h-1.5 bg-[#ba1a1a] rounded-full" />
                {Math.round((negCount / total) * 100)}% Neg
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Outcome Filters */}
      <section className="bg-[#f5f2ff] p-6 rounded-2xl border border-zinc-200/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h4 className="text-xl font-semibold text-[#1b1b24] mb-4">Call Outcome Breakdown</h4>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => { setActiveFilter('All'); setPage(1); }}
                className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-all active:scale-95 ${activeFilter === 'All' ? 'bg-[#3525cd] text-white' : 'bg-[#e4e1ee] text-[#1b1b24] hover:bg-[#c7c4d8]/50'}`}
                style={{fontFamily:'JetBrains Mono, monospace'}}
              >
                All Results <span className={`px-1.5 rounded text-[10px] ${activeFilter === 'All' ? 'bg-white/20' : 'bg-[#3525cd]/10 text-[#3525cd]'}`}>{contacts.length}</span>
              </button>
              {Object.entries(outcomeCounts).map(([outcome, count]) => (
                <button
                  key={outcome}
                  onClick={() => { setActiveFilter(outcome); setPage(1); }}
                  className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${activeFilter === outcome ? 'bg-[#3525cd] text-white' : 'bg-[#e4e1ee] text-[#1b1b24] hover:bg-[#c7c4d8]/50'}`}
                  style={{fontFamily:'JetBrains Mono, monospace'}}
                >
                  {outcome.replace('_', ' ')}
                  <span className={`px-1.5 rounded text-[10px] ${activeFilter === outcome ? 'bg-white/20' : 'bg-zinc-200 text-zinc-600'}`}>{count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#464555]">search</span>
              <input
                className="pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-[#3525cd] focus:border-[#3525cd] outline-none transition-all w-64 placeholder:text-[#777587]"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Results Table */}
      <section className="bg-white border border-zinc-200/80 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                {['Contact / Phone', 'Outcome', 'Sentiment', 'AI Score', 'Action'].map((h, i) => (
                  <th key={h} className={`px-6 py-4 text-sm text-zinc-600 ${i === 4 ? 'text-right' : ''}`} style={{fontFamily:'JetBrains Mono, monospace'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {paginated.map(c => {
                const sentimentInfo = SENTIMENT_ICON[c.sentiment] || null;
                const score = c.score != null ? Number(c.score).toFixed(1) : null;
                const scoreW = score ? `${Math.min(100, parseFloat(score) * 10)}%` : '0%';
                const outcomeBadge = OUTCOME_BADGE[c.outcome] || 'bg-zinc-100 text-zinc-600';
                const hasTranscript = c.outcome === 'COMPLETED';
                return (
                  <tr key={c.callLogId} className="hover:bg-zinc-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-[#1b1b24]">{c.contactName || 'Unknown'}</span>
                        <span className="text-xs text-zinc-400" style={{fontFamily:'JetBrains Mono, monospace'}}>{c.contactPhone || '—'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${outcomeBadge}`}>
                        {(c.outcome || 'unknown').replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {sentimentInfo ? (
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined text-[20px] ${sentimentInfo.color}`} style={{fontVariationSettings:"'FILL' 1"}}>{sentimentInfo.icon}</span>
                          <span className="text-sm text-[#464555] capitalize">{c.sentiment}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {score != null ? (
                        <div className="flex items-center gap-3">
                          <div className="w-16 bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-emerald-500 h-full" style={{width: scoreW}} />
                          </div>
                          <span className="text-sm font-medium text-[#1b1b24]" style={{fontFamily:'JetBrains Mono, monospace'}}>{score}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {hasTranscript ? (
                        <Link
                          to={`/campaign/${id}/calls/${c.callLogId}/report`}
                          className="text-[#3525cd] text-sm hover:underline inline-flex items-center gap-1"
                          style={{fontFamily:'JetBrains Mono, monospace'}}
                        >
                          View Report <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                        </Link>
                      ) : (
                        <span className="text-[#3525cd]/40 text-sm inline-flex items-center gap-1" style={{fontFamily:'JetBrains Mono, monospace'}}>
                          View Report <span className="material-symbols-outlined text-[16px]">lock</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredContacts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-[#777587]">
                    {searchQuery || activeFilter !== 'All' ? 'No contacts match your filters.' : 'No data available.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 bg-zinc-50/50 flex justify-between items-center border-t border-zinc-100">
          <p className="text-xs text-[#464555]" style={{fontFamily:'JetBrains Mono, monospace'}}>
            Showing {paginated.length} of {filteredContacts.length} evaluated calls
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-white border border-zinc-200 rounded text-xs hover:bg-zinc-50 disabled:opacity-30"
              style={{fontFamily:'JetBrains Mono, monospace'}}
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-white border border-zinc-200 rounded text-xs hover:bg-zinc-50 disabled:opacity-30"
              style={{fontFamily:'JetBrains Mono, monospace'}}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
