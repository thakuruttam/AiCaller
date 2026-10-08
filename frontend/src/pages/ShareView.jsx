import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../api/config';
import { Table, THead, Th, TBody, Tr, Td, CellStack, RowActions, TableToolbar, Badge, Button, IconButton, EmptyState, FilterBar } from '../components/ui';
import { useSort } from '../hooks/useSort';
import { useFacets } from '../hooks/useFacets';
import { exportCsv } from '../lib/exportCsv';

const OUTCOME_TONE = {
  COMPLETED:    'positive',
  NO_ANSWER:    'neutral',
  INCOMPLETE:   'caution',
  WRONG_PERSON: 'negative',
  RESCHEDULE:   'brand',
  BUSY:         'neutral',
  FAILED:       'negative',
};

const NO_CONTACTS = [];

const outcomeLabel = (outcome) => (outcome ? outcome.replace(/_/g, ' ').toLowerCase() : 'pending');

const SENTIMENT_COLOR = {
  positive: 'text-positive',
  neutral:  "text-ink-800 dark:text-ink-800",
  negative: 'text-negative',
};

const SENTIMENT_ICON = {
  positive: 'sentiment_satisfied',
  neutral:  'sentiment_neutral',
  negative: 'sentiment_dissatisfied',
};

function ScoreRing({ score }) {
  if (score == null) return <span className="text-xs text-ink-800 dark:text-ink-800">—</span>;
  const color = score >= 70 ? 'text-positive-dim' : score >= 40 ? 'text-caution-dim' : 'text-negative-dim';
  return <span className={`text-sm font-bold ${color}`}>{score}%</span>;
}

export default function ShareView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/share/${token}`);
        setData(res.data);
      } catch (e) {
        if (e.response?.status === 410) {
          setError('This share link has expired.');
        } else if (e.response?.status === 404) {
          setError('Share link not found.');
        } else {
          setError('Failed to load shared report.');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  useEffect(() => {
    document.title = data?.campaign?.name
      ? `${data.campaign.name} — Shared Report — AI Caller Pro`
      : 'Shared Campaign Report — AI Caller Pro';
  }, [data]);

  const filtered = (data?.contacts ?? NO_CONTACTS).filter(c =>
    !search || (c.contactName || '').toLowerCase().includes(search.toLowerCase())
  );
  const filters = useFacets(filtered, {
    outcome: { label: 'Outcome', get: c => c.outcome || 'PENDING', format: v => outcomeLabel(v === 'PENDING' ? null : v) },
    sentiment: { label: 'Sentiment', get: c => c.sentiment },
  });
  const isFiltered = !!search || filters.activeCount > 0;
  const clearAllFilters = () => { setSearch(''); filters.reset(); };

  const { sorted, sortProps } = useSort(filters.filtered, {
    contact: c => c.contactName,
    outcome: c => c.outcome,
    score: c => c.score,
    date: c => c.createdAt,
  });

  if (loading) return (
    <div className="min-h-screen bg-paper-200 dark:bg-ink-50 flex items-center justify-center">
      <div className="text-ink-700 dark:text-ink-900 text-sm">Loading shared report…</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-paper-200 dark:bg-ink-50 flex items-center justify-center">
      <div className="text-center">
        <span className="material-symbols-outlined text-[48px] text-ink-900 dark:text-ink-700 block mb-3">link_off</span>
        <p className="text-ink-600 dark:text-ink-900 font-semibold">{error}</p>
      </div>
    </div>
  );

  const { campaign, expiresAt, contacts } = data;

  const handleExport = () => exportCsv(`${campaign.name || 'shared-report'}-calls-${new Date().toISOString().slice(0, 10)}`, [
    { header: 'Contact', value: c => c.contactName },
    { header: 'Phone', value: c => c.phone },
    { header: 'Outcome', value: c => outcomeLabel(c.outcome) },
    { header: 'Score', value: c => c.score },
    { header: 'Sentiment', value: c => c.sentiment },
    { header: 'Date', value: c => c.createdAt && new Date(c.createdAt).toISOString().slice(0, 10) },
  ], sorted);

  const total = contacts.length;
  const completed = contacts.filter(c => c.outcome === 'COMPLETED').length;
  const avgScore = contacts.filter(c => c.score != null).length > 0
    ? Math.round(contacts.filter(c => c.score != null).reduce((s, c) => s + c.score, 0) / contacts.filter(c => c.score != null).length)
    : null;

  return (
    <div className="min-h-screen bg-paper-200 dark:bg-ink-50">
      {/* Header */}
      <header className="bg-ink-100 px-8 py-5 flex items-center gap-4 shadow-card">
        <div className="w-9 h-9 bg-brand-600 rounded flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-white text-[18px]" style={{fontVariationSettings:"'FILL' 1"}}>graphic_eq</span>
        </div>
        <div>
          <h1 className="text-white font-bold text-base leading-tight">AI Caller Pro</h1>
          <p className="text-ink-800 text-xs font-medium ">Shared Campaign Report</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-ink-800">Expires {new Date(expiresAt).toLocaleDateString()}</p>
        </div>
      </header>

      <main className="p-8 max-w-[1100px] mx-auto space-y-8">
        {/* Campaign title */}
        <div>
          <h2 className="text-[22px] font-semibold text-ink-100 dark:text-paper-200 tracking-tight">{campaign.name}</h2>
          <p className="text-ink-700 dark:text-ink-900 text-sm mt-1 capitalize">{campaign.type?.toLowerCase().replace('_', ' ')} campaign · {total} calls</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-5">
          <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-5">
            <p className="text-xs text-ink-700 dark:text-ink-900 mb-1">Total Calls</p>
            <p className="text-2xl font-bold text-ink-100 dark:text-paper-200">{total}</p>
          </div>
          <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-5">
            <p className="text-xs text-ink-700 dark:text-ink-900 mb-1">Completed</p>
            <p className="text-2xl font-bold text-positive-dim">{completed}</p>
          </div>
          <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-5">
            <p className="text-xs text-ink-700 dark:text-ink-900 mb-1">Avg Score</p>
            <p className="text-2xl font-bold text-brand-500">{avgScore != null ? `${avgScore}%` : '—'}</p>
          </div>
        </div>

        {/* Search + table */}
        <div className="bg-card dark:bg-muted rounded-2xl shadow-primary overflow-hidden">
          <TableToolbar
            title="Calls"
            count={sorted.length}
            actions={<>
              <IconButton title="Export CSV" icon="download" onClick={handleExport} disabled={!sorted.length} />
            </>}
          >
            <FilterBar filters={filters} />
            <div className="flex flex-1 items-center gap-2 md:max-w-xs md:ml-auto h-9 px-3 rounded-control bg-paper-200 dark:bg-white/[0.04] ring-1 ring-inset ring-border focus-within:ring-brand-500/50">
              <span className="material-symbols-outlined [--icon-size:18px] text-muted-foreground">search</span>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search contacts…"
                aria-label="Search contacts"
                className="flex-1 min-w-0 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </TableToolbar>
          {sorted.length === 0 ? (
            <EmptyState
              icon="search_off"
              title="No calls found"
              body={isFiltered ? 'Try a different name or clear the filters.' : undefined}
              action={isFiltered && <Button variant="secondary" size="sm" onClick={clearAllFilters}>Clear filters</Button>}
            />
          ) : (
            <Table>
              <THead>
                <Th {...sortProps('contact')}>Contact</Th>
                <Th {...sortProps('outcome')}>Outcome</Th>
                <Th align="right" {...sortProps('score')}>Score</Th>
                <Th>Sentiment</Th>
                <Th {...sortProps('date')}>Date</Th>
                <Th><span className="sr-only">Actions</span></Th>
              </THead>
              <TBody>
                {sorted.map(c => (
                  <Tr key={c.callLogId} onClick={() => navigate(`/share/${token}/calls/${c.callLogId}`)}>
                    <Td>
                      <CellStack title={c.contactName} meta={c.phone} />
                    </Td>
                    <Td>
                      {c.outcome ? (
                        <Badge tone={OUTCOME_TONE[c.outcome] || 'neutral'}>
                          {outcomeLabel(c.outcome)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Pending</span>
                      )}
                    </Td>
                    <Td numeric><ScoreRing score={c.score} /></Td>
                    <Td>
                      {c.sentiment ? (
                        <span className={`material-symbols-outlined [--icon-size:20px] ${SENTIMENT_COLOR[c.sentiment]}`} style={{fontVariationSettings:"'FILL' 1"}}>
                          {SENTIMENT_ICON[c.sentiment]}
                        </span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </Td>
                    <Td muted className="whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </Td>
                    <Td align="right">
                      <RowActions>
                        <Link
                          to={`/share/${token}/calls/${c.callLogId}`}
                          onClick={e => e.stopPropagation()}
                          className="text-xs font-semibold text-brand-500 hover:text-brand-600 transition-colors"
                        >
                          View →
                        </Link>
                      </RowActions>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </div>
      </main>
    </div>
  );
}
