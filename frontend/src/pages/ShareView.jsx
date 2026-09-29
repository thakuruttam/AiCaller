import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../api/config';
import FullscreenTable, { FullscreenButton } from '../components/FullscreenTable';

const OUTCOME_BADGE = {
  COMPLETED:    "bg-positive/10 text-positive-dim dark:bg-positive/15 dark:text-positive",
  NO_ANSWER:    "bg-paper-400 text-ink-600 dark:bg-ink-300 dark:text-ink-900",
  INCOMPLETE:   "bg-caution/10 text-caution-dim dark:bg-caution/15 dark:text-caution",
  WRONG_PERSON: 'bg-negative/10 text-negative-dim',
  RESCHEDULE:   "bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  BUSY:         "bg-paper-400 text-ink-600 dark:bg-ink-300 dark:text-ink-900",
  FAILED:       "bg-negative/10 text-negative-dim dark:bg-negative/15 dark:text-negative",
};

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
  const filtered = contacts.filter(c =>
    !search || (c.contactName || '').toLowerCase().includes(search.toLowerCase())
  );

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
          <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 p-5 rounded-card shadow-card">
            <p className="text-xs text-ink-700 dark:text-ink-900 mb-1">Total Calls</p>
            <p className="text-2xl font-bold text-ink-100 dark:text-paper-200">{total}</p>
          </div>
          <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 p-5 rounded-card shadow-card">
            <p className="text-xs text-ink-700 dark:text-ink-900 mb-1">Completed</p>
            <p className="text-2xl font-bold text-positive-dim">{completed}</p>
          </div>
          <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 p-5 rounded-card shadow-card">
            <p className="text-xs text-ink-700 dark:text-ink-900 mb-1">Avg Score</p>
            <p className="text-2xl font-bold text-brand-500">{avgScore != null ? `${avgScore}%` : '—'}</p>
          </div>
        </div>

        {/* Search + table */}
        <FullscreenTable className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card shadow-card overflow-hidden">
          {({ toggle, isFs }) => (<>
          <div className="px-5 py-4 border-b border-paper-400 dark:border-ink-400 flex items-center gap-3">
            <span className="material-symbols-outlined text-ink-800 dark:text-ink-800 text-[18px]">search</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts…"
              className="flex-1 text-sm bg-transparent outline-none text-ink-100 dark:text-paper-200 placeholder:text-ink-800 dark:placeholder:text-ink-700"
            />
            <FullscreenButton toggle={toggle} isFs={isFs} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-paper-200 dark:bg-ink-50 border-b border-paper-400 dark:border-ink-400">
                <tr>
                  <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 dark:text-ink-900 ">Contact</th>
                  <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 dark:text-ink-900 ">Outcome</th>
                  <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 dark:text-ink-900 ">Score</th>
                  <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 dark:text-ink-900 ">Sentiment</th>
                  <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 dark:text-ink-900 ">Date</th>
                  <th className="px-7 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-paper-400 dark:divide-ink-400/50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-ink-800 dark:text-ink-800 text-sm">No calls found</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.callLogId} className="hover:bg-paper-200 dark:hover:bg-ink-400/50 transition-colors">
                    <td className="px-7 py-5">
                      <p className="font-medium text-ink-100 dark:text-paper-200">{c.contactName}</p>
                      <p className="text-xs text-ink-800 dark:text-ink-800">{c.phone}</p>
                    </td>
                    <td className="px-7 py-5">
                      {c.outcome ? (
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${OUTCOME_BADGE[c.outcome] || "bg-paper-400 text-ink-600 dark:bg-ink-300 dark:text-ink-900"}`}>
                          {c.outcome.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-800 dark:text-ink-800 italic">Pending</span>
                      )}
                    </td>
                    <td className="px-7 py-5"><ScoreRing score={c.score} /></td>
                    <td className="px-7 py-5">
                      {c.sentiment ? (
                        <span className={`material-symbols-outlined text-[20px] ${SENTIMENT_COLOR[c.sentiment]}`} style={{fontVariationSettings:"'FILL' 1"}}>
                          {SENTIMENT_ICON[c.sentiment]}
                        </span>
                      ) : <span className="text-xs text-ink-800 dark:text-ink-800">—</span>}
                    </td>
                    <td className="px-7 py-5 text-xs text-ink-700 dark:text-ink-900">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-7 py-5 text-right">
                      <Link
                        to={`/share/${token}/calls/${c.callLogId}`}
                        className="text-xs font-semibold text-brand-500 hover:text-brand-600 transition-colors"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>)}
        </FullscreenTable>
      </main>
    </div>
  );
}
