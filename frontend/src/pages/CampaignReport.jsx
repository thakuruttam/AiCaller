import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Button, IconButton, Tabs, CopyField, Pagination } from '../components/ui';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import DebouncedSearch from '../components/DebouncedSearch';
import PageLoader from '../components/PageLoader';
import FullscreenTable, { FullscreenButton } from '../components/FullscreenTable';
import { EVAL_BASE } from '../api/config';

const SENTIMENT_ICON = {
  positive: { icon: 'sentiment_satisfied', color: 'text-positive' },
  neutral:  { icon: 'sentiment_neutral', color: 'text-ink-800' },
  negative: { icon: 'sentiment_dissatisfied', color: 'text-negative-dim' },
};

const OUTCOME_BADGE = {
  COMPLETED:    'bg-positive/10 text-positive-dim',
  NO_ANSWER:    'bg-paper-400 text-ink-600',
  INCOMPLETE:   'bg-caution/10 text-caution-dim',
  WRONG_PERSON: 'bg-negative/10 text-negative-dim',
  RESCHEDULE:   'bg-brand-100 text-brand-600',
  BUSY:         'bg-paper-400 text-ink-600',
  FAILED:       'bg-negative/10 text-negative-dim',
};

const OUTCOME_FILTER_KEYS = ['All', 'COMPLETED', 'NO_ANSWER', 'BUSY', 'INCOMPLETE', 'FAILED', 'WRONG_PERSON', 'RESCHEDULE'];

function ShareModal({ campaignId, onClose }) {
  const [days, setDays] = useState(7);
  const [link, setLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/api/share/campaigns/${campaignId}`, { validityDays: days });
      const url = `${window.location.origin}/share/${res.data.token}`;
      setLink({ url, expiresAt: res.data.expiresAt });
    } catch {
      addToast('Failed to generate link', 'error');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-paper-100 dark:bg-ink-200 rounded-card shadow-overlay w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-ink-100 dark:text-paper-200">Share Campaign Report</h3>
          <IconButton tone="neutral" size="md" title="Close" icon="close" onClick={onClose} />
        </div>

        {!link ? (
          <>
            <p className="text-sm text-ink-700 dark:text-ink-900 mb-5">
              Generate a public link to share all call reports for this campaign. No login required.
            </p>
            <div className="mb-5">
              <label className="block text-xs font-medium text-ink-600 dark:text-ink-900 mb-2">Link Valid For</label>
              <div className="flex gap-2">
                {[3, 7, 14, 30].map(d => (
                  <Button variant="primary" size="md" key={d} onClick={() => setDays(d)}>{d}d</Button>
                ))}
              </div>
            </div>
            <Button variant="primary" size="lg" onClick={generate} disabled={loading}>
              {loading ? <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Generating…</> : <><span className="material-symbols-outlined text-[18px]">link</span> Generate Link</>}
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-ink-700 dark:text-ink-900 mb-3">
              Expires on <strong>{new Date(link.expiresAt).toLocaleDateString()}</strong>
            </p>
            <CopyField value={link.url} className="mb-4" />
            <Button variant="secondary" size="md" onClick={() => setLink(null)}>Generate Another</Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CampaignReport() {
  const { id } = useParams();
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
    if (pct == null) return 'bg-paper-700';
    if (pct >= 70) return 'bg-positive';
    if (pct >= 40) return 'bg-caution';
    return 'bg-negative/100';
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
    } catch {
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
    <div className="p-10 max-w-[1200px] mx-auto">
      <Link to={`/campaigns/${id}`} className="flex items-center gap-2 text-ink-600 dark:text-ink-900 hover:text-brand-500 transition-colors text-sm mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Campaign Details
      </Link>
      <div className="p-5 rounded-card border border-negative/10 dark:border-negative/15 bg-negative/10/30 dark:bg-negative/15 flex items-center gap-3 text-negative-dim dark:text-negative text-sm">
        <span className="material-symbols-outlined">error</span>
        {error}
      </div>
    </div>
  );

  if (!metrics || metrics.totalCalls === 0) return (
    <div className="p-10 max-w-[1200px] mx-auto">
      <Link to={`/campaigns/${id}`} className="flex items-center gap-2 text-ink-600 dark:text-ink-900 hover:text-brand-500 transition-colors text-sm mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Campaign Details
      </Link>
      <div className="p-12 rounded-card border border-paper-500 dark:border-ink-400 bg-paper-100 dark:bg-ink-200 flex flex-col items-center justify-center text-ink-800 dark:text-ink-800">
        <span className="material-symbols-outlined text-[48px] mb-3 opacity-20">bar_chart</span>
        <p className="font-semibold text-ink-500 dark:text-ink-900">No Evaluation Data Yet</p>
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
    <div className="p-10 max-w-[1200px] mx-auto space-y-8">
      {/* Page Header */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <Link to="/" className="flex items-center gap-2 text-ink-600 dark:text-ink-900 hover:text-brand-500 transition-colors text-sm mb-3">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Active Campaigns
            </Link>
            <h2 className="text-[22px] font-semibold text-ink-100 dark:text-paper-200 mb-1">Campaign Performance Report</h2>
            <p className="text-ink-600 dark:text-ink-900">AI evaluation analytics &amp; extracted data</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="md" icon="share" onClick={() => setShowShare(true)}>Share</Button>
            <a
              href={`${EVAL_BASE}/reports/campaign/${id}/export.csv`}
              download
              className="flex items-center gap-2 px-4 py-2 border border-paper-600 dark:border-ink-400 text-ink-100 dark:text-paper-200 text-sm rounded hover:bg-paper-200 dark:hover:bg-ink-400 transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Export CSV
            </a>
            {progress && progress.total > 0 && (
              <div className="bg-paper-500 dark:bg-ink-200 p-4 rounded-card min-w-[280px]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-ink-100 dark:text-paper-200">AI Evaluation Progress</span>
                  <span className="text-xs text-brand-500 dark:text-brand-300">
                    {progress.completed + progress.failed} / {progress.total} Evaluated
                  </span>
                </div>
                <div className="w-full bg-paper-500 dark:bg-ink-300 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-brand-500 h-full transition-all duration-1000"
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
        <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500/80 dark:border-ink-400 p-6 rounded-card shadow-card hover:shadow-raised transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-brand-500/10 dark:bg-brand-500/10 text-brand-500 dark:text-brand-300 rounded-control">
              <span className="material-symbols-outlined">task_alt</span>
            </span>
          </div>
          <p className="text-ink-600 dark:text-ink-900 text-sm mb-1">Total Evaluated</p>
          <h3 className="text-2xl font-semibold text-ink-100 dark:text-paper-200">{total.toLocaleString()}</h3>
        </div>

        <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500/80 dark:border-ink-400 p-6 rounded-card shadow-card hover:shadow-raised transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-brand-100/30 dark:bg-brand-500/10 text-ink-600 dark:text-brand-300 rounded-control">
              <span className="material-symbols-outlined">percent</span>
            </span>
          </div>
          <p className="text-ink-600 dark:text-ink-900 text-sm mb-1">Completion Rate</p>
          <h3 className="text-2xl font-semibold text-brand-500 dark:text-brand-300">{completionPercent}%</h3>
        </div>

        <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500/80 dark:border-ink-400 p-6 rounded-card shadow-card hover:shadow-raised transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-positive/10 dark:bg-positive/10 text-positive-dim dark:text-positive rounded-control">
              <span className="material-symbols-outlined" style={{fontVariationSettings:"'FILL' 1"}}>star</span>
            </span>
          </div>
          <p className="text-ink-600 dark:text-ink-900 text-sm mb-1">Avg Score</p>
          <h3 className="text-2xl font-semibold text-positive-dim dark:text-positive">{avgScore} / 100</h3>
        </div>

        <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500/80 dark:border-ink-400 p-6 rounded-card shadow-card hover:shadow-raised transition-shadow">
          <p className="text-ink-600 dark:text-ink-900 text-sm mb-4">Sentiment Breakdown</p>
          <div className="flex flex-wrap gap-2">
            {posCount > 0 && (
              <span className="px-3 py-1 bg-positive/10 dark:bg-positive/10 text-positive-dim dark:text-positive rounded-full text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-positive/15 dark:bg-positive rounded-full" />
                {Math.round((posCount / total) * 100)}% Pos
              </span>
            )}
            {neuCount > 0 && (
              <span className="px-3 py-1 bg-paper-400 dark:bg-ink-300 text-ink-500 dark:text-ink-900 rounded-full text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-ink-700 dark:bg-paper-900 rounded-full" />
                {Math.round((neuCount / total) * 100)}% Neu
              </span>
            )}
            {negCount > 0 && (
              <span className="px-3 py-1 bg-negative/10 dark:bg-negative/100/10 text-negative-dim dark:text-negative rounded-full text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-negative-dim dark:bg-negative rounded-full" />
                {Math.round((negCount / total) * 100)}% Neg
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Results Section — By Contact / By Question */}
      <FullscreenTable className="flex flex-col gap-4 bg-paper-200/50 dark:bg-ink-50 rounded-card">
      {({ toggle, isFs }) => {
        const paginated = isFs ? filteredContacts : filteredContacts.slice((page - 1) * PER_PAGE, page * PER_PAGE);

        /* ── Question-view derived data ── */
        const qContacts = filteredContacts; // question view uses same search filter
        const qPaginated = isFs ? qContacts : qContacts.slice((page - 1) * PER_PAGE, page * PER_PAGE);
        const qTotalPages = Math.max(1, Math.ceil(qContacts.length / PER_PAGE));

        return (<>
        {/* Section header with view toggle */}
        <section className="bg-brand-100 dark:bg-ink-200/60 p-6 rounded-card border border-paper-500/50 dark:border-ink-400">
          <div className="flex flex-col gap-4">
            {/* Tab toggle + search row */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <Tabs
                value={viewMode}
                onChange={setViewMode}
                size="sm"
                items={[
                  { value: 'contact', label: 'By contact', icon: 'person' },
                  { value: 'question', label: 'By question', icon: 'help' },
                ]}
              />
              <div className="flex gap-2 items-center flex-wrap">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-ink-600 dark:text-ink-900">search</span>
                  <input
                    className="pl-10 pr-4 py-2.5 bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 text-ink-100 dark:text-paper-200 rounded-control text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all w-64 placeholder:text-ink-700 dark:placeholder:text-ink-700"
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                  />
                </div>
                {viewMode === 'question' && selectedQuestions.length > 0 && (
                  <>
                    <Button variant="secondary" size="sm" icon="download" onClick={() => downloadQuestionView('csv')} title="Download as CSV">CSV</Button>
                    <Button variant="secondary" size="sm" icon="table_view" onClick={() => downloadQuestionView('excel')} title="Download as Excel">Excel</Button>
                  </>
                )}
                <FullscreenButton toggle={toggle} isFs={isFs} />
              </div>
            </div>

            {/* Contact mode: outcome filter chips */}
            {viewMode === 'contact' && (
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" size="md" onClick={() => { setActiveFilter('All'); setPage(1); }}>
                  All Results <span className={`px-1.5 rounded text-[10px] ${activeFilter === 'All' ? 'bg-white/20' : 'bg-brand-500/10 dark:bg-brand-500/10 text-brand-500 dark:text-brand-300'}`}>{contacts.length}</span>
                </Button>
                {Object.entries(outcomeCounts).map(([outcome, count]) => (
                  <Button variant="primary" size="md" key={outcome} onClick={() => { setActiveFilter(outcome); setPage(1); }}>
                    {outcome.replace('_', ' ')}
                    <span className={`px-1.5 rounded text-[10px] ${activeFilter === outcome ? 'bg-white/20' : 'bg-paper-500 dark:bg-ink-400 text-ink-600 dark:text-ink-900'}`}>{count}</span>
                  </Button>
                ))}
              </div>
            )}

            {/* Question mode: question picker chips */}
            {viewMode === 'question' && allQuestions.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-xs text-ink-700 dark:text-ink-900">Select questions to display as columns:</p>
                  <div className="flex items-center gap-1 bg-paper-500 dark:bg-ink-300 p-0.5 rounded-control">
                    {[['text', 'Text'], ['score', 'Score'], ['both', 'Both']].map(([val, label]) => (
                      <Button variant="ghost" size="sm" key={val} onClick={() => setCellDisplay(val)}>{label}</Button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {allQuestions.map(q => {
                    const active = selectedQuestions.includes(q);
                    const avg = questionAvgScores[q];
                    return (
                      <Button variant="primary" size="sm" key={q} onClick={() => toggleQuestion(q)} title={q}>
                        <span className="max-w-[180px] truncate">{q.length > 40 ? q.slice(0, 40) + '…' : q}</span>
                        {avg != null && (
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${active ? 'bg-white/20 text-white' : avg >= 70 ? 'bg-positive/10 dark:bg-positive/10 text-positive-dim dark:text-positive' : avg >= 40 ? 'bg-caution/10 dark:bg-caution/100/10 text-caution-dim dark:text-caution' : 'bg-negative/10 dark:bg-negative/100/10 text-negative-dim dark:text-negative'}`}>
                            {avg}%
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
            {viewMode === 'question' && allQuestions.length === 0 && (
              <p className="text-sm text-ink-700 dark:text-ink-900">No extracted fields found. Make sure evaluation has run for at least one call.</p>
            )}
          </div>
        </section>

        {/* ── By Contact table ── */}
        {viewMode === 'contact' && (
        <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500/80 dark:border-ink-400 rounded-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-paper-200 dark:bg-ink-50 border-b border-paper-400 dark:border-ink-400">
                  {['Contact / Phone', 'Outcome', 'Sentiment', 'AI Score', 'Action'].map((h, i) => (
                    <th key={h} className={`px-6 py-4 text-xs font-medium text-ink-600 dark:text-ink-900 ${i === 4 ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-400 dark:divide-ink-400">
                {paginated.map(c => {
                  const sentimentInfo = SENTIMENT_ICON[c.sentiment] || null;
                  const score = c.score != null ? Number(c.score).toFixed(1) : null;
                  const scoreW = score ? `${Math.min(100, parseFloat(score) * 10)}%` : '0%';
                  const outcomeBadge = OUTCOME_BADGE[c.outcome] || 'bg-paper-400 text-ink-600';
                  const hasTranscript = c.outcome === 'COMPLETED';
                  return (
                    <tr key={c.callLogId} className="hover:bg-paper-200/80 dark:hover:bg-ink-400/50 transition-colors group">
                      <td className="px-7 py-5">
                        <div className="flex flex-col">
                          <span className="font-medium text-ink-100 dark:text-paper-200">{c.contactName || 'Unknown'}</span>
                          <span className="text-xs text-ink-800 dark:text-ink-800">{c.contactPhone || '—'}</span>
                        </div>
                      </td>
                      <td className="px-7 py-5">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold  ${outcomeBadge}`}>
                          {(c.outcome || 'unknown').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-7 py-5">
                        {sentimentInfo ? (
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined text-[20px] ${sentimentInfo.color}`} style={{fontVariationSettings:"'FILL' 1"}}>{sentimentInfo.icon}</span>
                            <span className="text-sm text-ink-600 dark:text-ink-900 capitalize">{c.sentiment}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-ink-800 dark:text-ink-800">—</span>
                        )}
                      </td>
                      <td className="px-7 py-5">
                        {score != null ? (
                          <div className="flex items-center gap-3">
                            <div className="w-16 bg-paper-400 dark:bg-ink-300 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-positive h-full" style={{width: scoreW}} />
                            </div>
                            <span className="text-sm font-medium text-ink-100 dark:text-paper-200">{score}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-ink-800 dark:text-ink-800">—</span>
                        )}
                      </td>
                      <td className="px-7 py-5 text-right">
                        {hasTranscript ? (
                          <Link
                            to={`/campaign/${id}/calls/${c.callLogId}/report`}
                            className="text-brand-500 dark:text-brand-300 text-sm hover:underline inline-flex items-center gap-1"
                          >
                            View Report <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                          </Link>
                        ) : (
                          <span className="text-brand-500/40 dark:text-brand-300/40 text-sm inline-flex items-center gap-1">
                            View Report <span className="material-symbols-outlined text-[16px]">lock</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredContacts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-ink-700 dark:text-ink-900">
                      {searchQuery || activeFilter !== 'All' ? 'No contacts match your filters.' : 'No data available.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalRows={filteredContacts.length}
            pageSize={isFs ? 0 : PER_PAGE}
            onPageChange={setPage}
            label="evaluated calls"
          />
        </div>
        )}

        {/* ── By Question table ── */}
        {viewMode === 'question' && selectedQuestions.length > 0 && (
        <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500/80 dark:border-ink-400 rounded-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-paper-200 dark:bg-ink-50 border-b border-paper-400 dark:border-ink-400">
                  <th className="px-7 py-4 text-xs font-medium text-ink-600 dark:text-ink-900 sticky left-0 bg-paper-200 dark:bg-ink-50 z-10 min-w-[180px]">Contact</th>
                  {selectedQuestions.map(q => {
                    const avg = questionAvgScores[q];
                    return (
                      <th key={q} className="px-4 py-4 text-xs font-medium text-ink-600 dark:text-ink-900 min-w-[200px] max-w-[240px]">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-ink-100 dark:text-paper-200 leading-snug line-clamp-2" title={q}>
                            {q.length > 55 ? q.slice(0, 55) + '…' : q}
                          </span>
                          {avg != null && (
                            <span className={`text-[11px] flex items-center gap-1 ${avg >= 70 ? 'text-positive-dim dark:text-positive' : avg >= 40 ? 'text-caution-dim dark:text-caution' : 'text-negative-dim dark:text-negative'}`}>
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
              <tbody className="divide-y divide-paper-400 dark:divide-ink-400">
                {qPaginated.map(c => (
                  <tr key={c.callLogId} className="hover:bg-paper-200/50 dark:hover:bg-ink-400/50 transition-colors">
                    <td className="px-7 py-5 sticky left-0 bg-paper-100 dark:bg-ink-200 group-hover:bg-paper-200/50 dark:group-hover:bg-ink-400/50 z-10">
                      <div className="flex flex-col">
                        <span className="font-medium text-ink-100 dark:text-paper-200 text-sm">{c.contactName || 'Unknown'}</span>
                        <span className="text-xs text-ink-800 dark:text-ink-800">{c.contactPhone || '—'}</span>
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
                                <span className="text-sm text-ink-100 dark:text-paper-200 line-clamp-2" title={field.value}>{field.value || '—'}</span>
                              )}
                              {(cellDisplay === 'score' || cellDisplay === 'both') && pct != null && (
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${qScoreDot(pct)}`} />
                                  <span className={`text-[11px] font-semibold ${pct >= 70 ? 'text-positive-dim dark:text-positive' : pct >= 40 ? 'text-caution-dim dark:text-caution' : 'text-negative-dim dark:text-negative'}`}>
                                    {pct}%
                                  </span>
                                  {cellDisplay !== 'score' && sbEntry?.reason && (
                                    <span className="text-[10px] text-ink-800 dark:text-ink-800 truncate max-w-[80px]" title={sbEntry.reason}>{sbEntry.reason}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-ink-900 dark:text-ink-700">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {qContacts.length === 0 && (
                  <tr>
                    <td colSpan={selectedQuestions.length + 1} className="px-6 py-12 text-center text-sm text-ink-700 dark:text-ink-900">
                      {searchQuery ? 'No contacts match your search.' : 'No data available.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={qTotalPages}
            totalRows={qContacts.length}
            pageSize={isFs ? 0 : PER_PAGE}
            onPageChange={setPage}
            label="contacts"
          />
        </div>
        )}

        {viewMode === 'question' && selectedQuestions.length === 0 && allQuestions.length > 0 && (
          <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500/80 dark:border-ink-400 rounded-card p-12 text-center text-sm text-ink-800 dark:text-ink-800">
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
