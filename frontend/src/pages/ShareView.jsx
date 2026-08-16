import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../api/config';
import FullscreenTable, { FullscreenButton } from '../components/FullscreenTable';

const OUTCOME_BADGE = {
  COMPLETED:    'bg-emerald-50 text-emerald-700',
  NO_ANSWER:    'bg-zinc-100 text-zinc-600',
  INCOMPLETE:   'bg-amber-50 text-amber-700',
  WRONG_PERSON: 'bg-[#ffdad6] text-[#ba1a1a]',
  RESCHEDULE:   'bg-blue-50 text-blue-700',
  BUSY:         'bg-zinc-100 text-zinc-600',
  FAILED:       'bg-[#ffdad6] text-[#ba1a1a]',
};

const SENTIMENT_COLOR = {
  positive: 'text-emerald-500',
  neutral:  'text-zinc-400',
  negative: 'text-red-500',
};

const SENTIMENT_ICON = {
  positive: 'sentiment_satisfied',
  neutral:  'sentiment_neutral',
  negative: 'sentiment_dissatisfied',
};

function ScoreRing({ score }) {
  if (score == null) return <span className="text-xs text-zinc-400">—</span>;
  const color = score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';
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
    <div className="min-h-screen bg-[#f8f7ff] flex items-center justify-center">
      <div className="text-[#64748b] text-sm">Loading shared report…</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#f8f7ff] flex items-center justify-center">
      <div className="text-center">
        <span className="material-symbols-outlined text-[48px] text-zinc-300 block mb-3">link_off</span>
        <p className="text-zinc-600 font-semibold">{error}</p>
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
    <div className="min-h-screen bg-[#f8f7ff]">
      {/* Header */}
      <header className="bg-[#0f172a] px-8 py-5 flex items-center gap-4 shadow-sm">
        <div className="w-9 h-9 bg-[#0f766e] rounded flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-white text-[18px]" style={{fontVariationSettings:"'FILL' 1"}}>graphic_eq</span>
        </div>
        <div>
          <h1 className="text-white font-bold text-base leading-tight">AI Caller Pro</h1>
          <p className="text-zinc-400 text-[11px] uppercase tracking-widest font-mono">Shared Campaign Report</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-zinc-400 font-mono">Expires {new Date(expiresAt).toLocaleDateString()}</p>
        </div>
      </header>

      <main className="p-8 max-w-[1100px] mx-auto space-y-8">
        {/* Campaign title */}
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">{campaign.name}</h2>
          <p className="text-zinc-500 text-sm mt-1 capitalize">{campaign.type?.toLowerCase().replace('_', ' ')} campaign · {total} calls</p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-5">
          <div className="bg-white border border-zinc-200 p-5 rounded-xl shadow-sm">
            <p className="text-xs text-zinc-500 font-mono mb-1">Total Calls</p>
            <p className="text-2xl font-bold text-zinc-900">{total}</p>
          </div>
          <div className="bg-white border border-zinc-200 p-5 rounded-xl shadow-sm">
            <p className="text-xs text-zinc-500 font-mono mb-1">Completed</p>
            <p className="text-2xl font-bold text-emerald-600">{completed}</p>
          </div>
          <div className="bg-white border border-zinc-200 p-5 rounded-xl shadow-sm">
            <p className="text-xs text-zinc-500 font-mono mb-1">Avg Score</p>
            <p className="text-2xl font-bold text-[#0d9488]">{avgScore != null ? `${avgScore}%` : '—'}</p>
          </div>
        </div>

        {/* Search + table */}
        <FullscreenTable className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
          {({ toggle, isFs }) => (<>
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
            <span className="material-symbols-outlined text-zinc-400 text-[18px]">search</span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search contacts…"
              className="flex-1 text-sm bg-transparent outline-none text-zinc-800 placeholder:text-zinc-400"
            />
            <FullscreenButton toggle={toggle} isFs={isFs} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider font-mono">Contact</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider font-mono">Outcome</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider font-mono">Score</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider font-mono">Sentiment</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider font-mono">Date</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-zinc-400 text-sm">No calls found</td></tr>
                ) : filtered.map(c => (
                  <tr key={c.callLogId} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-zinc-900">{c.contactName}</p>
                      <p className="text-xs text-zinc-400">{c.phone}</p>
                    </td>
                    <td className="px-5 py-4">
                      {c.outcome ? (
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${OUTCOME_BADGE[c.outcome] || 'bg-zinc-100 text-zinc-600'}`}>
                          {c.outcome.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400 italic">Pending</span>
                      )}
                    </td>
                    <td className="px-5 py-4"><ScoreRing score={c.score} /></td>
                    <td className="px-5 py-4">
                      {c.sentiment ? (
                        <span className={`material-symbols-outlined text-[20px] ${SENTIMENT_COLOR[c.sentiment]}`} style={{fontVariationSettings:"'FILL' 1"}}>
                          {SENTIMENT_ICON[c.sentiment]}
                        </span>
                      ) : <span className="text-xs text-zinc-400">—</span>}
                    </td>
                    <td className="px-5 py-4 text-xs text-zinc-500 font-mono">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/share/${token}/calls/${c.callLogId}`}
                        className="text-xs font-semibold text-[#0d9488] hover:text-[#0f766e] transition-colors"
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
