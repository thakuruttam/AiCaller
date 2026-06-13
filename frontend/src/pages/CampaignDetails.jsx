import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import PageLoader from '../components/PageLoader';
import SandboxAgent from './CampaignWizard/components/SandboxAgent.jsx';
import Modal from '../components/Modal';
import DebouncedSearch from '../components/DebouncedSearch';
import { useToast } from '../context/ToastContext';
import FullscreenTable, { FullscreenButton } from '../components/FullscreenTable';

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
      setLink({ url: `${window.location.origin}/share/${res.data.token}`, expiresAt: res.data.expiresAt });
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-zinc-900">Share Campaign Report</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-zinc-100 text-zinc-500 transition-colors">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        {!link ? (
          <>
            <p className="text-sm text-zinc-500 mb-5">Generate a public link to share all call reports for this campaign. No login required.</p>
            <div className="mb-5">
              <label className="block text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-2">Link Valid For</label>
              <div className="flex gap-2">
                {[3, 7, 14, 30].map(d => (
                  <button key={d} onClick={() => setDays(d)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${days === d ? 'bg-[#0d9488] text-white border-[#0d9488]' : 'border-zinc-200 text-zinc-600 hover:border-[#0d9488]'}`}>
                    {d}d
                  </button>
                ))}
              </div>
            </div>
            <button onClick={generate} disabled={loading}
              className="w-full py-3 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Generating…</> : <><span className="material-symbols-outlined text-[18px]">link</span> Generate Link</>}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-zinc-500 mb-3">Expires on <strong>{new Date(link.expiresAt).toLocaleDateString()}</strong></p>
            <div className="flex items-center gap-2 p-3 rounded-xl border border-zinc-200 bg-zinc-50 mb-4">
              <span className="text-xs text-zinc-700 flex-1 break-all font-mono">{link.url}</span>
              <button onClick={copy} className="shrink-0 p-1.5 rounded-lg hover:bg-zinc-200 transition-colors text-zinc-500">
                <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
              </button>
            </div>
            <button onClick={() => setLink(null)}
              className="w-full py-2.5 border border-zinc-200 rounded-xl text-sm text-zinc-600 hover:bg-zinc-50 transition-colors">
              Generate Another
            </button>
          </>
        )}
      </div>
    </div>
  );
}

const STATUS_BADGE = {
  completed:    'bg-emerald-100 text-emerald-800',
  queued:       'bg-zinc-100 text-zinc-600',
  'in-progress':'bg-amber-100 text-amber-800',
  failed:       'bg-[#ffdad6] text-[#ba1a1a]',
  cancelled:    'bg-orange-50 text-orange-700',
};

const STATUS_DOT = {
  completed:    'bg-emerald-500',
  queued:       'bg-zinc-400',
  'in-progress':'bg-amber-500',
  failed:       'bg-[#ba1a1a]',
  cancelled:    'bg-orange-400',
};

const INITIALS_COLORS = ['bg-[#e2dfff] text-[#0d9488]','bg-emerald-50 text-emerald-700','bg-amber-50 text-amber-700','bg-red-50 text-red-700','bg-teal-50 text-teal-700'];

function getInitials(name) {
  return (name || '?').split(' ').map(p => p[0]).join('').substring(0,2).toUpperCase();
}

export default function CampaignDetails() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  useEffect(() => { fetchCampaignDetails(); }, [id]);

  const fetchCampaignDetails = async () => {
    try {
      const res = await api.get('/api/campaigns');
      const camp = res.data.find(c => c.id === id);
      setCampaign(camp);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader text="Loading campaign…" />;
  if (!campaign) return (
    <div className="flex items-center justify-center h-64 text-sm text-[#64748b]">Campaign not found.</div>
  );

  const contacts = campaign.campaignContacts || [];
  const logs = campaign.callLogs || [];
  const completed = logs.filter(l => l.status === 'completed').length;
  const avgDuration = logs.filter(l => l.durationMs).length
    ? Math.round(logs.filter(l => l.durationMs).reduce((a,l) => a + l.durationMs, 0) / logs.filter(l => l.durationMs).length / 1000)
    : 0;
  const successRate = logs.length ? ((completed / logs.length) * 100).toFixed(1) : '0.0';

  const filteredContacts = contacts.filter(cc => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (cc.overrides?.name || cc.contact?.name || '').toLowerCase().includes(q) ||
      (cc.contact?.phone || '').toLowerCase().includes(q) ||
      (cc.overrides?.tag || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / PER_PAGE));

  return (
    <div className="p-8 max-w-[1440px] mx-auto bg-[#f0fdfa] min-h-full">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link to="/" className="flex items-center gap-1 text-[#0d9488] hover:underline transition-all text-sm" style={{fontFamily:'JetBrains Mono, monospace'}}>
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-[#64748b]" style={{fontFamily:'JetBrains Mono, monospace'}}>Campaign Details</p>
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-semibold text-[#0f172a] tracking-tight">{campaign.name}</h2>
            <span className="px-2.5 py-0.5 bg-[#e2dfff]/50 text-[#0d9488] border border-[#0d9488]/20 rounded text-xs" style={{fontFamily:'JetBrains Mono, monospace'}}>{campaign.type || 'Campaign'}</span>
          </div>
          <p className="text-base text-[#334155] max-w-2xl">
            {campaign.callModule?.callIntro || 'Automated outreach campaign.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowShare(true)}
            className="px-4 py-2 bg-white border border-zinc-200 text-zinc-900 text-sm rounded shadow-sm hover:bg-zinc-50 transition-all flex items-center gap-2"
            style={{fontFamily:'JetBrains Mono, monospace'}}
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
            Share
          </button>
          <Link
            to={`/campaigns/${id}/report`}
            className="px-4 py-2 bg-white border border-zinc-200 text-zinc-900 text-sm rounded shadow-sm hover:bg-zinc-50 transition-all flex items-center gap-2"
            style={{fontFamily:'JetBrains Mono, monospace'}}
          >
            <span className="material-symbols-outlined text-[18px]">analytics</span>
            Report
          </Link>
          <button
            onClick={() => setIsSandboxOpen(true)}
            className="px-4 py-2 bg-[#0d9488] text-white text-sm rounded shadow-sm hover:bg-[#0f766e] transition-all flex items-center gap-2"
            style={{fontFamily:'JetBrains Mono, monospace'}}
          >
            <span className="material-symbols-outlined text-[18px]">science</span>
            AI Sandbox
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label:'Total Contacts', value: contacts.length.toLocaleString(), barColor:'bg-[#0d9488]', barW:'100%' },
          { label:'Calls Completed', value: completed.toLocaleString(), barColor:'bg-emerald-500', barW:`${logs.length ? (completed/logs.length*100) : 0}%` },
          { label:'Avg. Duration', value: avgDuration >= 60 ? `${Math.floor(avgDuration/60)}m ${avgDuration%60}s` : `${avgDuration}s`, barColor:'bg-amber-500', barW:'50%' },
          { label:'Success Rate', value: `${successRate}%`, barColor:'bg-teal-500', barW:`${successRate}%` },
        ].map(s => (
          <div key={s.label} className="bg-white border border-zinc-200 p-6 rounded shadow-sm">
            <p className="text-xs text-[#334155] mb-2" style={{fontFamily:'JetBrains Mono, monospace'}}>{s.label}</p>
            <p className="text-2xl font-semibold text-[#0f172a]">{s.value}</p>
            <div className="mt-2 h-1 w-full bg-zinc-100 rounded">
              <div className={`h-1 ${s.barColor} rounded`} style={{width:s.barW}}></div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity Table */}
      <FullscreenTable className="bg-white border border-zinc-200 rounded shadow-sm overflow-hidden">
        {({ toggle, isFs }) => {
          const paginated = isFs ? filteredContacts : filteredContacts.slice((page-1)*PER_PAGE, page*PER_PAGE);
          return (<>
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <h3 className="text-lg font-semibold text-[#0f172a]">Contact Call Status</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#334155] text-[18px]">filter_list</span>
              <input
                className="pl-10 pr-4 py-1.5 border border-zinc-300 rounded text-sm text-[#0f172a] focus:ring-2 focus:ring-[#0d9488] focus:border-[#0d9488] outline-none transition-all placeholder:text-[#64748b]"
                placeholder="Filter activity..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>
            <button className="p-1.5 hover:bg-zinc-200 rounded transition-all">
              <span className="material-symbols-outlined text-[#334155]">download</span>
            </button>
            <FullscreenButton toggle={toggle} isFs={isFs} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                {['Name','Phone','Tags / Overrides','Status','Duration','Call Details'].map(h => (
                  <th key={h} className="px-6 py-4 text-xs text-[#334155] uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {paginated.map((cc, i) => {
                const contact = cc.contact;
                const log = logs.find(l => l.contactId === contact?.id);
                const name = cc.overrides?.name || contact?.name || '?';
                const initials = getInitials(name);
                const colorClass = INITIALS_COLORS[i % INITIALS_COLORS.length];
                const status = log?.status;
                const durationMs = log?.durationMs;
                const durationStr = durationMs
                  ? `${Math.floor(durationMs/60000)}m ${Math.round((durationMs%60000)/1000)}s`
                  : '—';

                return (
                  <tr key={cc.id} className="hover:bg-zinc-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs ${colorClass}`}>{initials}</div>
                        <span className="text-base font-medium text-[#0f172a]">{name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#334155]" style={{fontFamily:'JetBrains Mono, monospace'}}>
                      {contact?.phone || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        {cc.overrides?.tag && (
                          <span className="px-2 py-0.5 bg-[#e2dfff]/60 text-[#0d9488] rounded-full text-[10px] border border-[#5eead4]" style={{fontFamily:'JetBrains Mono, monospace'}}>{cc.overrides.tag}</span>
                        )}
                        {cc.overrides?.goals && (
                          <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 rounded-full text-[10px] border border-zinc-200" style={{fontFamily:'JetBrains Mono, monospace'}}>Script Override</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {status ? (
                        <span className={`px-3 py-1 rounded-full text-xs flex items-center gap-1.5 w-fit ${STATUS_BADGE[status] || STATUS_BADGE.queued}`} style={{fontFamily:'JetBrains Mono, monospace'}}>
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status] || 'bg-zinc-400'}`}></span>
                          {status === 'in-progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      ) : (
                        <span className="text-xs text-[#64748b] italic" style={{fontFamily:'JetBrains Mono, monospace'}}>No call</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-[#334155]" style={{fontFamily:'JetBrains Mono, monospace'}}>{durationStr}</td>
                    <td className="px-6 py-4">
                      {log ? (
                        <Link
                          to={`/campaign/${id}/calls/${log.id}`}
                          className="flex items-center gap-1.5 text-[#0d9488] hover:text-[#0f766e] transition-colors"
                          style={{fontFamily:'JetBrains Mono, monospace'}}
                        >
                          <span className="material-symbols-outlined text-[18px]">article</span>
                          <span className="text-sm">View Call</span>
                        </Link>
                      ) : (
                        <span className="text-xs text-zinc-300 italic" style={{fontFamily:'JetBrains Mono, monospace'}}>N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredContacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-[#64748b]">
                    {searchQuery ? 'No contacts match your search.' : 'No contacts in this campaign.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-between">
          <span className="text-xs text-[#334155]" style={{fontFamily:'JetBrains Mono, monospace'}}>
            {isFs ? `${filteredContacts.length} entries` : `Showing ${paginated.length} of ${filteredContacts.length} entries`}
          </span>
          {!isFs && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page <= 1} className="p-1 hover:bg-zinc-100 rounded disabled:opacity-30">
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              {[...Array(Math.min(3, totalPages))].map((_, i) => (
                <button key={i+1} onClick={() => setPage(i+1)} className={`px-3 py-1 rounded text-xs ${page===i+1 ? 'bg-[#0d9488] text-white' : 'hover:bg-zinc-100 text-[#0f172a]'}`} style={{fontFamily:'JetBrains Mono, monospace'}}>{i+1}</button>
              ))}
              {totalPages > 3 && <span className="px-2 text-zinc-400">...</span>}
              {totalPages > 3 && (
                <button onClick={() => setPage(totalPages)} className={`px-3 py-1 rounded text-xs ${page===totalPages ? 'bg-[#0d9488] text-white' : 'hover:bg-zinc-100 text-[#0f172a]'}`} style={{fontFamily:'JetBrains Mono, monospace'}}>{totalPages}</button>
              )}
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page >= totalPages} className="p-1 hover:bg-zinc-100 rounded disabled:opacity-30">
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          )}
        </div>
        </>);
        }}
      </FullscreenTable>

      <Modal isOpen={isSandboxOpen} onClose={() => setIsSandboxOpen(false)} title="AI Sandbox — Live Test" className="max-w-2xl w-full">
        <SandboxAgent campaign={campaign} />
      </Modal>

      {showShare && <ShareModal campaignId={id} onClose={() => setShowShare(false)} />}
    </div>
  );
}
