import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Button, IconButton, Tabs, Pagination, Input, Table, THead, Th, TBody, Tr, Td, CellStack, TableToolbar, FilterBar,
  StatCard, Progress, Badge, StatusBadge, Page, PageHeader, BackLink, Card, EmptyState, Alert, statusLabel,
} from '../components/ui';
import { useSort } from '../hooks/useSort';
import { useFacets } from '../hooks/useFacets';
import { exportCsv } from '../lib/exportCsv';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import PageLoader from '../components/PageLoader';
import ShareCampaignModal from '../components/ShareCampaignModal';
import { EVAL_BASE } from '../api/config';

const SENTIMENT_ICON = {
  positive: { icon: 'sentiment_satisfied', color: 'text-positive' },
  neutral:  { icon: 'sentiment_neutral', color: 'text-muted-foreground' },
  negative: { icon: 'sentiment_dissatisfied', color: 'text-negative-dim' },
};

const outcomeLabel = (outcome) => statusLabel(outcome || 'unknown');

export default function CampaignReport() {
  const { id } = useParams();
  const [metrics, setMetrics] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [progress, setProgress] = useState(null);
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
    return 'bg-negative';
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

  // Search, then outcome/sentiment facets, then sort. Both views read the
  // result, so the "By question" table honours the same filters and order.
  const filters = useFacets(
    contacts.filter(c => !searchQuery || (c.contactName || '').toLowerCase().includes(searchQuery.toLowerCase())),
    {
      outcome: { label: 'Outcome', get: c => c.outcome, format: outcomeLabel },
      sentiment: { label: 'Sentiment', get: c => c.sentiment },
    },
    { onChange: () => setPage(1) },
  );
  const isFiltered = !!searchQuery || filters.activeCount > 0;
  const clearAllFilters = () => { setSearchQuery(''); filters.reset(); setPage(1); };

  const { sorted: filteredContacts, sortProps } = useSort(filters.filtered, {
    name: c => c.contactName,
    outcome: c => c.outcome,
    sentiment: c => c.sentiment,
    score: c => (c.score != null ? Number(c.score) : null),
  });

  if (loading) return <PageLoader text="Loading campaign report…" />;

  if (error) return (
    <Page>
      <BackLink to={`/campaigns/${id}`} className="mb-6">Back to campaign details</BackLink>
      <Alert tone="negative" title="Could not load report">{error}</Alert>
    </Page>
  );

  if (!metrics || metrics.totalCalls === 0) return (
    <Page>
      <BackLink to={`/campaigns/${id}`} className="mb-6">Back to campaign details</BackLink>
      <Card padded={false}>
        <EmptyState
          icon="bar_chart"
          title="No evaluation data yet"
          body="Run AI evaluation on calls to generate reports."
        />
      </Card>
    </Page>
  );

  const completionPercent = Math.round((parseFloat(metrics.completionRate) || 0) * 100);
  const avgScore = metrics.score?.avg ?? '—';
  const sentiment = metrics.sentimentBreakdown || {};
  const total = metrics.totalCalls || 0;
  const posCount = sentiment.positive || 0;
  const neuCount = sentiment.neutral || 0;
  const negCount = sentiment.negative || 0;

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / PER_PAGE));

  const handleExportContacts = () => exportCsv(`campaign-${id}-contacts-${new Date().toISOString().slice(0, 10)}`, [
    { header: 'Contact', value: c => c.contactName || 'Unknown' },
    { header: 'Phone', value: c => c.contactPhone },
    { header: 'Outcome', value: c => outcomeLabel(c.outcome) },
    { header: 'Sentiment', value: c => c.sentiment },
    { header: 'AI score', value: c => (c.score != null ? Number(c.score) : null) },
  ], filteredContacts);

  const progressPct = progress && progress.total > 0
    ? Math.round(((progress.completed + progress.failed) / progress.total) * 100)
    : 0;

  const paginated = filteredContacts.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  /* ── Question-view derived data ── */
  const qContacts = filteredContacts; // question view uses same search filter
  const qPaginated = qContacts.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const qTotalPages = Math.max(1, Math.ceil(qContacts.length / PER_PAGE));

  return (
    <Page className="space-y-6">
      <PageHeader
        className="!mb-0"
        back={{ to: `/campaigns/${id}`, label: 'Back to campaign details' }}
        title="Campaign performance report"
        subtitle="AI evaluation analytics & extracted data"
        actions={<>
          <Button variant="secondary" icon="share" onClick={() => setShowShare(true)}>Share</Button>
          <Button as="a" href={`${EVAL_BASE}/reports/campaign/${id}/export.csv`} download variant="secondary" icon="download">
            Export CSV
          </Button>
          {progress && progress.total > 0 && (
            <Card padded={false} className="min-w-[260px] px-4 py-3">
              <Progress
                value={progressPct}
                label={`AI evaluation · ${progress.completed + progress.failed} / ${progress.total}`}
                showValue
              />
            </Card>
          )}
        </>}
      />

      {/* KPI Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon="task_alt" label="Total evaluated" value={total.toLocaleString()} />
        <StatCard icon="percent" label="Completion rate" value={`${completionPercent}%`}>
          <Progress value={Number(completionPercent) || 0} />
        </StatCard>
        <StatCard icon="star" label="Avg score" value={`${avgScore} / 100`} />
        <StatCard icon="sentiment_satisfied" label="Sentiment" value={total ? `${Math.round((posCount / total) * 100)}%` : '—'} hint={total ? 'Positive' : 'No evaluations yet'}>
          {total > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="positive" capitalize={false}>{Math.round((posCount / total) * 100)}% Pos</Badge>
              <Badge tone="neutral" capitalize={false}>{Math.round((neuCount / total) * 100)}% Neu</Badge>
              <Badge tone="negative" capitalize={false}>{Math.round((negCount / total) * 100)}% Neg</Badge>
            </div>
          )}
        </StatCard>
      </section>

      {/* Results Section — By Contact / By Question */}
      <div className="flex flex-col gap-4">
        {/* Section header with view toggle */}
        <Card padded={false} className="overflow-hidden">
          <TableToolbar
            actions={<>
              {viewMode === 'contact' && (
                <IconButton title="Export CSV" icon="download" onClick={handleExportContacts} disabled={!filteredContacts.length} />
              )}
              {viewMode === 'question' && selectedQuestions.length > 0 && (
                <>
                  <Button variant="secondary" size="sm" icon="download" onClick={() => downloadQuestionView('csv')} title="Download as CSV">CSV</Button>
                  <Button variant="secondary" size="sm" icon="table_view" onClick={() => downloadQuestionView('excel')} title="Download as Excel">Excel</Button>
                </>
              )}
            </>}
          >
            <Tabs
              value={viewMode}
              onChange={setViewMode}
              size="sm"
              items={[
                { value: 'contact', label: 'By contact', icon: 'person', count: filteredContacts.length },
                { value: 'question', label: 'By question', icon: 'help' },
              ]}
            />
            <FilterBar filters={filters} />
            <div className="w-full md:w-64 md:ml-auto">
              <Input
                icon="search"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>
          </TableToolbar>

          {/* Question mode: question picker chips */}
          {viewMode === 'question' && allQuestions.length > 0 && (
            <div className="flex flex-col gap-3 px-5 py-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-muted-foreground">Select questions to display as columns:</p>
                <Tabs
                  value={cellDisplay}
                  onChange={setCellDisplay}
                  size="sm"
                  items={[
                    { value: 'text', label: 'Text' },
                    { value: 'score', label: 'Score' },
                    { value: 'both', label: 'Both' },
                  ]}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {allQuestions.map(q => {
                  const active = selectedQuestions.includes(q);
                  const avg = questionAvgScores[q];
                  return (
                    <Button
                      variant={active ? 'subtle' : 'secondary'}
                      size="sm"
                      key={q}
                      onClick={() => toggleQuestion(q)}
                      title={q}
                      aria-pressed={active}
                      icon={active ? 'check' : undefined}
                      className={active ? 'ring-1 ring-inset ring-brand-500/40' : ''}
                    >
                      <span className="max-w-[180px] truncate">{q.length > 40 ? q.slice(0, 40) + '…' : q}</span>
                      {avg != null && (
                        <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${avg >= 70 ? 'bg-positive/10 text-positive-dim dark:text-positive' : avg >= 40 ? 'bg-caution/10 text-caution-dim dark:text-caution' : 'bg-negative/10 text-negative-dim dark:text-negative'}`}>
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
            <p className="px-5 py-4 text-sm text-muted-foreground">No extracted fields found. Make sure evaluation has run for at least one call.</p>
          )}
        </Card>

        {/* ── By Contact table ── */}
        {viewMode === 'contact' && (
        <Card padded={false} className="overflow-hidden">
          <Table>
            <THead>
              <Th {...sortProps('name')}>Contact / Phone</Th>
              <Th {...sortProps('outcome')}>Outcome</Th>
              <Th {...sortProps('sentiment')}>Sentiment</Th>
              <Th {...sortProps('score')}>AI score</Th>
              <Th align="right">Action</Th>
            </THead>
            <TBody>
                {paginated.map(c => {
                  const sentimentInfo = SENTIMENT_ICON[c.sentiment] || null;
                  const score = c.score != null ? Number(c.score).toFixed(1) : null;
                  const hasTranscript = c.outcome === 'COMPLETED';
                  return (
                    <Tr key={c.callLogId}>
                      <Td>
                        <CellStack title={c.contactName || 'Unknown'} meta={c.contactPhone || '—'} />
                      </Td>
                      <Td>
                        <StatusBadge status={c.outcome || 'unknown'} />
                      </Td>
                      <Td>
                        {sentimentInfo ? (
                          <div className="flex items-center gap-2">
                            <span className={`material-symbols-outlined [--icon-size:18px] ${sentimentInfo.color}`} style={{fontVariationSettings:"'FILL' 1"}}>{sentimentInfo.icon}</span>
                            <span className="text-muted-foreground capitalize">{c.sentiment}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Td>
                      <Td>
                        {score != null ? (
                          <div className="flex items-center gap-3">
                            <Progress tone="positive" value={parseFloat(score) * 10} className="w-16" />
                            <span className="font-medium tabular-nums">{score}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Td>
                      <Td align="right">
                        {hasTranscript ? (
                          <Button as={Link} to={`/campaign/${id}/calls/${c.callLogId}/report`} variant="ghost" size="sm" iconRight="open_in_new">
                            View report
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" iconRight="lock" disabled title="Available once the call is completed">
                            View report
                          </Button>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
                {filteredContacts.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      {isFiltered ? (
                        <EmptyState
                          icon="search_off"
                          title="No contacts match your filters"
                          body="Try a different search, or clear the filters."
                          action={<Button variant="secondary" size="sm" onClick={clearAllFilters}>Clear filters</Button>}
                        />
                      ) : (
                        <EmptyState icon="bar_chart" title="No evaluated calls yet" />
                      )}
                    </td>
                  </tr>
                )}
            </TBody>
          </Table>
          <Pagination
            page={page}
            totalPages={totalPages}
            totalRows={filteredContacts.length}
            pageSize={PER_PAGE}
            onPageChange={setPage}
            label="evaluated calls"
          />
        </Card>
        )}

        {/* ── By Question table ── */}
        {viewMode === 'question' && selectedQuestions.length > 0 && (
        <Card padded={false} className="overflow-hidden">
          <Table className="min-w-max">
            <THead>
                  <Th {...sortProps('name')} className="sticky left-0 z-10 min-w-[180px] bg-paper-200 dark:bg-muted">Contact</Th>
                  {selectedQuestions.map(q => {
                    const avg = questionAvgScores[q];
                    return (
                      <Th key={q} className="min-w-[200px] max-w-[240px] !whitespace-normal py-2.5">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-foreground leading-snug line-clamp-2" title={q}>
                            {q.length > 55 ? q.slice(0, 55) + '…' : q}
                          </span>
                          {avg != null && (
                            <span className={`text-[11px] flex items-center gap-1 ${avg >= 70 ? 'text-positive-dim dark:text-positive' : avg >= 40 ? 'text-caution-dim dark:text-caution' : 'text-negative-dim dark:text-negative'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${qScoreDot(avg)}`} />
                              Avg {avg}%
                            </span>
                          )}
                        </div>
                      </Th>
                    );
                  })}
            </THead>
            <TBody>
                {qPaginated.map(c => (
                  <Tr key={c.callLogId}>
                    <Td className="sticky left-0 z-10 bg-card dark:bg-muted group-hover/row:bg-paper-200 transition-colors">
                      <CellStack title={c.contactName || 'Unknown'} meta={c.contactPhone || '—'} />
                    </Td>
                    {selectedQuestions.map(q => {
                      const field = c.extractedFields?.[q];
                      const sbEntry = (c.scoreBreakdown || []).find(s => s.field === q);
                      const pct = sbEntry && sbEntry.maxPoints ? Math.round((sbEntry.awarded / sbEntry.maxPoints) * 100) : null;
                      const hasData = field || pct != null;
                      return (
                        <Td key={q} className="max-w-[240px]">
                          {hasData ? (
                            <div className="flex flex-col gap-1">
                              {(cellDisplay === 'text' || cellDisplay === 'both') && field && (
                                <span className="line-clamp-2" title={field.value}>{field.value || '—'}</span>
                              )}
                              {(cellDisplay === 'score' || cellDisplay === 'both') && pct != null && (
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${qScoreDot(pct)}`} />
                                  <span className={`text-[11px] font-semibold ${pct >= 70 ? 'text-positive-dim dark:text-positive' : pct >= 40 ? 'text-caution-dim dark:text-caution' : 'text-negative-dim dark:text-negative'}`}>
                                    {pct}%
                                  </span>
                                  {cellDisplay !== 'score' && sbEntry?.reason && (
                                    <span className="text-[10px] text-muted-foreground truncate max-w-[80px]" title={sbEntry.reason}>{sbEntry.reason}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </Td>
                      );
                    })}
                  </Tr>
                ))}
                {qContacts.length === 0 && (
                  <tr>
                    <td colSpan={selectedQuestions.length + 1}>
                      {isFiltered ? (
                        <EmptyState
                          icon="search_off"
                          title="No contacts match your filters"
                          body="Try a different search, or clear the filters."
                          action={<Button variant="secondary" size="sm" onClick={clearAllFilters}>Clear filters</Button>}
                        />
                      ) : (
                        <EmptyState icon="bar_chart" title="No evaluated calls yet" />
                      )}
                    </td>
                  </tr>
                )}
            </TBody>
          </Table>
          <Pagination
            page={page}
            totalPages={qTotalPages}
            totalRows={qContacts.length}
            pageSize={PER_PAGE}
            onPageChange={setPage}
            label="contacts"
          />
        </Card>
        )}

        {viewMode === 'question' && selectedQuestions.length === 0 && allQuestions.length > 0 && (
          <Card padded={false}>
            <EmptyState icon="checklist" title="No questions selected" body="Select at least one question above to see the breakdown." />
          </Card>
        )}
      </div>

      <ShareCampaignModal campaignId={id} isOpen={showShare} onClose={() => setShowShare(false)} />
    </Page>
  );
}
