import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import DebouncedSearch from '../components/DebouncedSearch';
import PageLoader from '../components/PageLoader';
import FullscreenTable, { FullscreenButton } from '../components/FullscreenTable';
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

function ShareModal({ campaignId, onClose }) {
  const [days, setDays] = useState(7);
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { addToast } = useToast();

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/api/share/campaigns/${campaignId}`, { validityDays: days });
      const url = `${window.location.origin}/share/${res.data.token}`;
      setLink({ url, expiresAt: res.data.expiresAt });
    } catch (e) {
      addToast('Failed to generate link', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(link.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-slate-100">Share Campaign Report</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-slate-700 text-zinc-500 transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {!link ? (
          <>
            <p className="text-sm text-zinc-500 dark:text-slate-400 mb-5">
              Generate a public link to share all call reports for this campaign. No login required.
            </p>
            <div className="mb-5">
              <label className="block text-xs font-semibold text-zinc-600 dark:text-slate-400 uppercase tracking-wider mb-2">Link Valid For</label>
              <div className="flex gap-2">
                {[3, 7, 14, 30].map(d => (
                  <button
                    key={d}
                    onClick={() => setDays(d)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${days === d ? 'bg-[#0d9488] text-white border-[#0d9488]' : 'border-zinc-200 dark:border-slate-600 text-zinc-600 dark:text-slate-300 hover:border-[#0d9488]'}`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={generate}
              disabled={loading}
              className="w-full py-3 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Generating…</> : <><span className="material-symbols-outlined text-[18px]">link</span> Generate Link</>}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-zinc-500 dark:text-slate-400 mb-3">
              Expires on <strong>{new Date(link.expiresAt).toLocaleDateString()}</strong>
            </p>
            <div className="flex items-center gap-2 p-3 rounded-xl border border-zinc-200 dark:border-slate-600 bg-zinc-50 dark:bg-slate-900 mb-4">
              <span className="text-xs text-zinc-700 dark:text-slate-300 flex-1 break-all font-mono">{link.url}</span>
              <button onClick={copy} className="shrink-0 p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-slate-700 transition-colors text-zinc-500">
                <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
              </button>
            </div>
            <button
              onClick={() => setLink(null)}
              className="w-full py-2.5 border border-zinc-200 dark:border-slate-600 rounded-xl text-sm text-zinc-600 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700 transition-colors"
            >
              Generate Another
            </button>
          </>
        )}
      </div>
    </div>
  );
}

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
  const [showShare, setShowShare] = useState(false);
  const [viewMode, setViewMode] = useState('contact');
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [cellDisplay, setCellDisplay] = useState('both'); // 'text' | 'score' | 'both'
  const questionInitRef = useRef(false);
  const PER_PAGE = 10;

  const allQuestions = useMemo(() => {
    const qSet = new Set();
    contacts.forEach(c => Object.keys(c.extractedFields || {}).forEach(q => qSet.add(q)));
    return [...qSet];
  }, [contacts]);

  useEffect(() => {
    if (!questionInitRef.current && allQuestions.length > 0) {
      questionInitRef.current = true;
      setSelectedQuestions(allQuestions.slice(0, 3));
    }
  }, [allQuestions]);

  const toggleQuestion = (q) => setSelectedQuestions(prev =>
    prev.includes(q) ? prev.filter(x => x !== q) : [...prev, q]
  );

  const questionAvgScores = useMemo(() => {
    const result = {};
    allQuestions.forEach(q => {
      const scores = contacts
        .map(c => {
          const entry = (c.scoreBreakdown || []).find(s => s.field === q);
          return entry && entry.maxPoints ? (entry.awarded / entry.maxPoints) * 100 : null;
        })
        .filter(s => s !== null);
      result[q] = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    });
    return result;
  }, [allQuestions, contacts]);

  const qScoreDot = (pct) => {
    if (pct == null) return 'bg-zinc-300';
    if (pct >= 70) return 'bg-emerald-500';
    if (pct >= 40) return 'bg-amber-400';
    return 'bg-red-500';
  };

  const downloadQuestionView = (format) => {
    const qs = selectedQuestions.length > 0 ? selectedQuestions : allQuestions;
    const rows = filteredContacts.map(c => {
      const base = { Contact: c.contactName || 'Unknown', Phone: c.contactPhone || '' };
      qs.forEach(q => {
        const val = c.extractedFields?.[q]?.value || '';
        const sbEntry = (c.scoreBreakdown || []).find(s => s.field === q);
        const pct = sbEntry && sbEntry.maxPoints ? Math.round((sbEntry.awarded / sbEntry.maxPoints) * 100) : '';
        const short = q.length > 40 ? q.slice(0, 40) + '…' : q;
        base[short] = val;
        base[`${short} (Score%)`] = pct;
      });
      return base;
    });

    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);

    if (format === 'csv') {
      const escape = v => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [headers.map(escape).join(','), ...rows.map(r => headers.map(h => escape(r[h] ?? '')).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'question-report.csv'; a.click();
    } else {
      // Excel-compatible TSV in .xls wrapper
      const tsv = [headers.join('\t'), ...rows.map(r => headers.map(h => String(r[h] ?? '')).join('\t'))].join('\n');
      const blob = new Blob(['﻿' + tsv], { type: 'application/vnd.ms-excel' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'question-report.xls'; a.click();
    }
  };

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

  if (loading) return <PageLoader text="Loading campaign report…" />;

  if (error) return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <Link to={`/campaigns/${id}`} className="flex items-center gap-2 text-[#334155] hover:text-[#0d9488] transition-colors text-sm mb-6" style={{fontFamily:'JetBrains Mono, monospace'}}>
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
      <Link to={`/campaigns/${id}`} className="flex items-center gap-2 text-[#334155] hover:text-[#0d9488] transition-colors text-sm mb-6" style={{fontFamily:'JetBrains Mono, monospace'}}>
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
            <Link to="/" className="flex items-center gap-2 text-[#334155] hover:text-[#0d9488] transition-colors text-sm mb-3" style={{fontFamily:'JetBrains Mono, monospace'}}>
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Active Campaigns
            </Link>
            <h2 className="text-3xl font-semibold text-[#0f172a] tracking-tight mb-1">Campaign Performance Report</h2>
            <p className="text-[#334155]">AI evaluation analytics &amp; extracted data</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowShare(true)}
              className="flex items-center gap-2 px-4 py-2 border border-zinc-300 text-[#0f172a] text-sm rounded hover:bg-zinc-50 transition-all"
              style={{fontFamily:'JetBrains Mono, monospace'}}
            >
              <span className="material-symbols-outlined text-[18px]">share</span>
              Share
            </button>
            <a
              href={`${EVAL_BASE}/reports/campaign/${id}/export.csv`}
              download
              className="flex items-center gap-2 px-4 py-2 border border-zinc-300 text-[#0f172a] text-sm rounded hover:bg-zinc-50 transition-all"
              style={{fontFamily:'JetBrains Mono, monospace'}}
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Export CSV
            </a>
            {progress && progress.total > 0 && (
              <div className="bg-[#e2e8f0] p-4 rounded-xl min-w-[280px]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-[#0f172a]" style={{fontFamily:'JetBrains Mono, monospace'}}>AI Evaluation Progress</span>
                  <span className="text-xs text-[#0d9488]" style={{fontFamily:'JetBrains Mono, monospace'}}>
                    {progress.completed + progress.failed} / {progress.total} Evaluated
                  </span>
                </div>
                <div className="w-full bg-zinc-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#0d9488] h-full transition-all duration-1000"
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
            <span className="p-2 bg-[#0d9488]/10 text-[#0d9488] rounded-lg">
              <span className="material-symbols-outlined">task_alt</span>
            </span>
          </div>
          <p className="text-[#334155] text-sm mb-1" style={{fontFamily:'JetBrains Mono, monospace'}}>Total Evaluated</p>
          <h3 className="text-2xl font-semibold text-[#0f172a]">{total.toLocaleString()}</h3>
        </div>

        <div className="bg-white border border-zinc-200/80 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-[#dae2fd]/30 text-[#565e74] rounded-lg">
              <span className="material-symbols-outlined">percent</span>
            </span>
          </div>
          <p className="text-[#334155] text-sm mb-1" style={{fontFamily:'JetBrains Mono, monospace'}}>Completion Rate</p>
          <h3 className="text-2xl font-semibold text-[#0d9488]">{completionPercent}%</h3>
        </div>

        <div className="bg-white border border-zinc-200/80 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-emerald-50 text-emerald-700 rounded-lg">
              <span className="material-symbols-outlined" style={{fontVariationSettings:"'FILL' 1"}}>star</span>
            </span>
          </div>
          <p className="text-[#334155] text-sm mb-1" style={{fontFamily:'JetBrains Mono, monospace'}}>Avg Score</p>
          <h3 className="text-2xl font-semibold text-emerald-700">{avgScore} / 100</h3>
        </div>

        <div className="bg-white border border-zinc-200/80 p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <p className="text-[#334155] text-sm mb-4" style={{fontFamily:'JetBrains Mono, monospace'}}>Sentiment Breakdown</p>
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

      {/* Results Section — By Contact / By Question */}
      <FullscreenTable className="flex flex-col gap-4 bg-zinc-50/50 dark:bg-[#13131f] rounded-2xl">
      {({ toggle, isFs }) => {
        const paginated = isFs ? filteredContacts : filteredContacts.slice((page - 1) * PER_PAGE, page * PER_PAGE);

        /* ── Question-view derived data ── */
        const qContacts = filteredContacts; // question view uses same search filter
        const qPaginated = isFs ? qContacts : qContacts.slice((page - 1) * PER_PAGE, page * PER_PAGE);
        const qTotalPages = Math.max(1, Math.ceil(qContacts.length / PER_PAGE));

        return (<>
        {/* Section header with view toggle */}
        <section className="bg-[#f0fdfa] p-6 rounded-2xl border border-zinc-200/50">
          <div className="flex flex-col gap-4">
            {/* Tab toggle + search row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-1 bg-[#e2e8f0] p-1 rounded-xl w-fit">
                <button
                  onClick={() => setViewMode('contact')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'contact' ? 'bg-white text-[#0d9488] shadow-sm' : 'text-[#334155] hover:text-[#0f172a]'}`}
                  style={{fontFamily:'JetBrains Mono, monospace'}}
                >
                  By Contact
                </button>
                <button
                  onClick={() => setViewMode('question')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${viewMode === 'question' ? 'bg-white text-[#0d9488] shadow-sm' : 'text-[#334155] hover:text-[#0f172a]'}`}
                  style={{fontFamily:'JetBrains Mono, monospace'}}
                >
                  By Question
                </button>
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#334155]">search</span>
                  <input
                    className="pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0d9488] focus:border-[#0d9488] outline-none transition-all w-64 placeholder:text-[#64748b]"
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                  />
                </div>
                {viewMode === 'question' && selectedQuestions.length > 0 && (
                  <>
                    <button
                      onClick={() => downloadQuestionView('csv')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs text-[#334155] hover:bg-zinc-50 transition-colors"
                      style={{fontFamily:'JetBrains Mono, monospace'}}
                      title="Download as CSV"
                    >
                      <span className="material-symbols-outlined text-[16px]">download</span>
                      CSV
                    </button>
                    <button
                      onClick={() => downloadQuestionView('excel')}
                      className="flex items-center gap-1.5 px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs text-[#334155] hover:bg-zinc-50 transition-colors"
                      style={{fontFamily:'JetBrains Mono, monospace'}}
                      title="Download as Excel"
                    >
                      <span className="material-symbols-outlined text-[16px]">table_view</span>
                      Excel
                    </button>
                  </>
                )}
                <FullscreenButton toggle={toggle} isFs={isFs} />
              </div>
            </div>

            {/* Contact mode: outcome filter chips */}
            {viewMode === 'contact' && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { setActiveFilter('All'); setPage(1); }}
                  className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-all active:scale-95 ${activeFilter === 'All' ? 'bg-[#0d9488] text-white' : 'bg-[#e2e8f0] text-[#0f172a] hover:bg-[#cbd5e1]/50'}`}
                  style={{fontFamily:'JetBrains Mono, monospace'}}
                >
                  All Results <span className={`px-1.5 rounded text-[10px] ${activeFilter === 'All' ? 'bg-white/20' : 'bg-[#0d9488]/10 text-[#0d9488]'}`}>{contacts.length}</span>
                </button>
                {Object.entries(outcomeCounts).map(([outcome, count]) => (
                  <button
                    key={outcome}
                    onClick={() => { setActiveFilter(outcome); setPage(1); }}
                    className={`px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${activeFilter === outcome ? 'bg-[#0d9488] text-white' : 'bg-[#e2e8f0] text-[#0f172a] hover:bg-[#cbd5e1]/50'}`}
                    style={{fontFamily:'JetBrains Mono, monospace'}}
                  >
                    {outcome.replace('_', ' ')}
                    <span className={`px-1.5 rounded text-[10px] ${activeFilter === outcome ? 'bg-white/20' : 'bg-zinc-200 text-zinc-600'}`}>{count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Question mode: question picker chips */}
            {viewMode === 'question' && allQuestions.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs text-[#64748b]" style={{fontFamily:'JetBrains Mono, monospace'}}>Select questions to display as columns:</p>
                  <div className="flex items-center gap-1 bg-[#e2e8f0] p-0.5 rounded-lg">
                    {[['text', 'Text'], ['score', 'Score'], ['both', 'Both']].map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setCellDisplay(val)}
                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${cellDisplay === val ? 'bg-white text-[#0d9488] shadow-sm' : 'text-[#334155] hover:text-[#0f172a]'}`}
                        style={{fontFamily:'JetBrains Mono, monospace'}}
                      >{label}</button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allQuestions.map(q => {
                    const active = selectedQuestions.includes(q);
                    const avg = questionAvgScores[q];
                    return (
                      <button
                        key={q}
                        onClick={() => toggleQuestion(q)}
                        title={q}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${active ? 'bg-[#0d9488] text-white border-[#0d9488]' : 'bg-white text-[#334155] border-zinc-200 hover:border-[#0d9488]/50'}`}
                        style={{fontFamily:'JetBrains Mono, monospace'}}
                      >
                        <span className="max-w-[180px] truncate">{q.length > 40 ? q.slice(0, 40) + '…' : q}</span>
                        {avg != null && (
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${active ? 'bg-white/20 text-white' : avg >= 70 ? 'bg-emerald-50 text-emerald-700' : avg >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>
                            {avg}%
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {viewMode === 'question' && allQuestions.length === 0 && (
              <p className="text-sm text-[#64748b]" style={{fontFamily:'JetBrains Mono, monospace'}}>No extracted fields found. Make sure evaluation has run for at least one call.</p>
            )}
          </div>
        </section>

        {/* ── By Contact table ── */}
        {viewMode === 'contact' && (
        <div className="bg-white border border-zinc-200/80 rounded-xl shadow-sm overflow-hidden">
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
                          <span className="font-medium text-[#0f172a]">{c.contactName || 'Unknown'}</span>
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
                            <span className="text-sm text-[#334155] capitalize">{c.sentiment}</span>
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
                            <span className="text-sm font-medium text-[#0f172a]" style={{fontFamily:'JetBrains Mono, monospace'}}>{score}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {hasTranscript ? (
                          <Link
                            to={`/campaign/${id}/calls/${c.callLogId}/report`}
                            className="text-[#0d9488] text-sm hover:underline inline-flex items-center gap-1"
                            style={{fontFamily:'JetBrains Mono, monospace'}}
                          >
                            View Report <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                          </Link>
                        ) : (
                          <span className="text-[#0d9488]/40 text-sm inline-flex items-center gap-1" style={{fontFamily:'JetBrains Mono, monospace'}}>
                            View Report <span className="material-symbols-outlined text-[16px]">lock</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredContacts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-[#64748b]">
                      {searchQuery || activeFilter !== 'All' ? 'No contacts match your filters.' : 'No data available.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-zinc-50/50 flex justify-between items-center border-t border-zinc-100">
            <p className="text-xs text-[#334155]" style={{fontFamily:'JetBrains Mono, monospace'}}>
              {isFs ? `${filteredContacts.length} evaluated calls` : `Showing ${paginated.length} of ${filteredContacts.length} evaluated calls`}
            </p>
            {!isFs && (
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 bg-white border border-zinc-200 rounded text-xs hover:bg-zinc-50 disabled:opacity-30"
                  style={{fontFamily:'JetBrains Mono, monospace'}}
                >Previous</button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 bg-white border border-zinc-200 rounded text-xs hover:bg-zinc-50 disabled:opacity-30"
                  style={{fontFamily:'JetBrains Mono, monospace'}}
                >Next</button>
              </div>
            )}
          </div>
        </div>
        )}

        {/* ── By Question table ── */}
        {viewMode === 'question' && selectedQuestions.length > 0 && (
        <div className="bg-white border border-zinc-200/80 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  <th className="px-6 py-4 text-sm text-zinc-600 sticky left-0 bg-zinc-50 z-10 min-w-[180px]" style={{fontFamily:'JetBrains Mono, monospace'}}>Contact</th>
                  {selectedQuestions.map(q => {
                    const avg = questionAvgScores[q];
                    return (
                      <th key={q} className="px-4 py-4 text-sm text-zinc-600 min-w-[200px] max-w-[240px]" style={{fontFamily:'JetBrains Mono, monospace'}}>
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-[#0f172a] leading-snug line-clamp-2" title={q}>
                            {q.length > 55 ? q.slice(0, 55) + '…' : q}
                          </span>
                          {avg != null && (
                            <span className={`text-[11px] flex items-center gap-1 ${avg >= 70 ? 'text-emerald-600' : avg >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${qScoreDot(avg)}`} />
                              Avg {avg}%
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {qPaginated.map(c => (
                  <tr key={c.callLogId} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-6 py-4 sticky left-0 bg-white group-hover:bg-zinc-50/50 z-10">
                      <div className="flex flex-col">
                        <span className="font-medium text-[#0f172a] text-sm">{c.contactName || 'Unknown'}</span>
                        <span className="text-xs text-zinc-400" style={{fontFamily:'JetBrains Mono, monospace'}}>{c.contactPhone || '—'}</span>
                      </div>
                    </td>
                    {selectedQuestions.map(q => {
                      const field = c.extractedFields?.[q];
                      const sbEntry = (c.scoreBreakdown || []).find(s => s.field === q);
                      const pct = sbEntry && sbEntry.maxPoints ? Math.round((sbEntry.awarded / sbEntry.maxPoints) * 100) : null;
                      const hasData = field || pct != null;
                      return (
                        <td key={q} className="px-4 py-4 max-w-[240px]">
                          {hasData ? (
                            <div className="flex flex-col gap-1">
                              {(cellDisplay === 'text' || cellDisplay === 'both') && field && (
                                <span className="text-sm text-[#0f172a] line-clamp-2" title={field.value}>{field.value || '—'}</span>
                              )}
                              {(cellDisplay === 'score' || cellDisplay === 'both') && pct != null && (
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${qScoreDot(pct)}`} />
                                  <span className={`text-[11px] font-semibold ${pct >= 70 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600'}`} style={{fontFamily:'JetBrains Mono, monospace'}}>
                                    {pct}%
                                  </span>
                                  {cellDisplay !== 'score' && sbEntry?.reason && (
                                    <span className="text-[10px] text-zinc-400 truncate max-w-[80px]" title={sbEntry.reason}>{sbEntry.reason}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-zinc-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {qContacts.length === 0 && (
                  <tr>
                    <td colSpan={selectedQuestions.length + 1} className="px-6 py-12 text-center text-sm text-[#64748b]">
                      {searchQuery ? 'No contacts match your search.' : 'No data available.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-4 bg-zinc-50/50 flex justify-between items-center border-t border-zinc-100">
            <p className="text-xs text-[#334155]" style={{fontFamily:'JetBrains Mono, monospace'}}>
              {isFs ? `${qContacts.length} contacts` : `Showing ${qPaginated.length} of ${qContacts.length} contacts`}
            </p>
            {!isFs && (
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 bg-white border border-zinc-200 rounded text-xs hover:bg-zinc-50 disabled:opacity-30"
                  style={{fontFamily:'JetBrains Mono, monospace'}}
                >Previous</button>
                <button
                  onClick={() => setPage(p => Math.min(qTotalPages, p + 1))}
                  disabled={page >= qTotalPages}
                  className="px-3 py-1 bg-white border border-zinc-200 rounded text-xs hover:bg-zinc-50 disabled:opacity-30"
                  style={{fontFamily:'JetBrains Mono, monospace'}}
                >Next</button>
              </div>
            )}
          </div>
        </div>
        )}

        {viewMode === 'question' && selectedQuestions.length === 0 && allQuestions.length > 0 && (
          <div className="bg-white border border-zinc-200/80 rounded-xl p-12 text-center text-sm text-zinc-400">
            Select at least one question above to see the breakdown.
          </div>
        )}
        </>);
      }}
      </FullscreenTable>

      {showShare && <ShareModal campaignId={id} onClose={() => setShowShare(false)} />}
    </div>
  );
}
