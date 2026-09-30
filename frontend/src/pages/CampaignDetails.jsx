import React, { useEffect, useState } from 'react';
import { campaignTypeLabel } from '../components/campaignTypes';
import { Button, IconButton, CopyField, Badge, StatusBadge, Page, Pagination } from '../components/ui';
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
  const { addToast } = useToast();

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api.post(`/api/share/campaigns/${campaignId}`, { validityDays: days });
      setLink({ url: `${window.location.origin}/share/${res.data.token}`, expiresAt: res.data.expiresAt });
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
            <p className="text-sm text-ink-700 dark:text-ink-900 mb-5">Generate a public link to share all call reports for this campaign. No login required.</p>
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
            <p className="text-xs text-ink-700 dark:text-ink-900 mb-3">Expires on <strong>{new Date(link.expiresAt).toLocaleDateString()}</strong></p>
            <CopyField value={link.url} className="mb-4" />
            <Button variant="secondary" size="md" onClick={() => setLink(null)}>Generate Another</Button>
          </>
        )}
      </div>
    </div>
  );
}

const INITIALS_COLORS = [
  'bg-brand-100 text-brand-500 dark:bg-brand-600/30 dark:text-brand-300',
  'bg-positive/10 text-positive-dim dark:bg-positive/15 dark:text-positive',
  'bg-caution/10 text-caution-dim dark:bg-caution/15 dark:text-caution',
  'bg-negative/10 text-negative-dim dark:bg-negative/15 dark:text-negative',
  'bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
];

function getInitials(name) {
  return (name || '?').split(' ').map(p => p[0]).join('').substring(0,2).toUpperCase();
}

export default function CampaignDetails() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  useEffect(() => { fetchCampaignDetails(); }, [id]);

  const fetchCampaignDetails = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get(`/api/campaigns/${id}`);
      setCampaign(res.data);
    } catch (e) {
      console.error(e);
      setLoadError(e.response?.status === 403 ? 'access-denied' : 'not-found');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageLoader text="Loading campaign…" />;
  if (loadError || !campaign) return (
    <div className="flex items-center justify-center h-64 text-sm text-ink-700 dark:text-ink-900">
      {loadError === 'access-denied' ? "You don't have access to this campaign." : 'Campaign not found.'}
    </div>
  );

  const contacts = campaign.campaignContacts || [];
  const logs = campaign.callLogs || [];
  const completed = logs.filter(l => l.status === 'completed').length;
  const avgDuration = logs.filter(l => l.durationMs).length
    ? Math.round(logs.filter(l => l.durationMs).reduce((a,l) => a + l.durationMs, 0) / logs.filter(l => l.durationMs).length / 1000)
    : 0;
  const successRate = logs.length ? ((completed / logs.length) * 100).toFixed(1) : '0.0';

  // One row per call attempt (not per contact) — a re-run keeps every past
  // completed/failed log (see campaign.controller.js `rerun`), so a contact
  // called multiple times must show each call, each with its own recording
  // and transcript, instead of only the most recent attempt hiding the rest.
  // `logs` is already ordered newest-first from the API. Contacts with no
  // call yet still get a single placeholder row.
  const contactById = new Map(contacts.map(cc => [cc.contactId, cc]));
  const loggedContactIds = new Set(logs.map(l => l.contactId));
  const rows = [
    ...logs.map(log => ({ log, cc: contactById.get(log.contactId) })).filter(r => r.cc),
    ...contacts.filter(cc => !loggedContactIds.has(cc.contactId)).map(cc => ({ log: null, cc })),
  ];

  const filteredRows = rows.filter(({ cc }) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (cc.overrides?.name || cc.contact?.name || '').toLowerCase().includes(q) ||
      (cc.contact?.phone || '').toLowerCase().includes(q) ||
      (cc.overrides?.tag || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PER_PAGE));

  return (
    <Page>
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link to="/" className="flex items-center gap-1 text-brand-500 hover:underline transition-all text-sm">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Dashboard
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div className="space-y-1">
          <p className="text-xs text-ink-700 dark:text-ink-900">Campaign Details</p>
          <div className="flex items-center gap-3">
            <h2 className="text-[22px] font-semibold text-ink-100 dark:text-paper-200">{campaign.name}</h2>
            <Badge tone="brand" className="whitespace-nowrap">{campaignTypeLabel(campaign.type) || 'Campaign'}</Badge>
          </div>
          <p className="text-sm text-ink-600 dark:text-ink-900 max-w-2xl">
            {campaign.callModule?.callIntro || 'Automated outreach campaign.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="md" icon="share" onClick={() => setShowShare(true)}>Share</Button>
          <Link
            to={`/campaigns/${id}/report`}
            className="px-4 py-2 bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 text-ink-100 dark:text-paper-200 text-sm rounded shadow-card hover:bg-paper-200 dark:hover:bg-ink-400 transition-all flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">analytics</span>
            Report
          </Link>
          <Button variant="primary" size="md" icon="science" onClick={() => setIsSandboxOpen(true)}>AI Sandbox</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { label:'Total Contacts', value: contacts.length.toLocaleString(), barColor:'bg-brand-500', barW:'100%' },
          { label:'Calls Completed', value: completed.toLocaleString(), barColor:'bg-positive', barW:`${logs.length ? (completed/logs.length*100) : 0}%` },
          { label:'Avg. Duration', value: avgDuration >= 60 ? `${Math.floor(avgDuration/60)}m ${avgDuration%60}s` : `${avgDuration}s`, barColor:'bg-caution/100', barW:'50%' },
          { label:'Success Rate', value: `${successRate}%`, barColor:'bg-brand-500', barW:`${successRate}%` },
        ].map(s => (
          <div key={s.label} className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 p-6 rounded shadow-card">
            <p className="text-xs text-ink-600 dark:text-ink-900 mb-2">{s.label}</p>
            <p className="text-2xl font-semibold text-ink-100 dark:text-paper-200">{s.value}</p>
            <div className="mt-2 h-1 w-full bg-paper-400 dark:bg-ink-300 rounded">
              <div className={`h-1 ${s.barColor} rounded`} style={{width:s.barW}}></div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity Table */}
      <FullscreenTable className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded shadow-card overflow-hidden">
        {({ toggle, isFs }) => {
          const paginated = isFs ? filteredRows : filteredRows.slice((page-1)*PER_PAGE, page*PER_PAGE);
          return (<>
        <div className="px-6 py-4 border-b border-paper-400 dark:border-ink-400 flex items-center justify-between bg-paper-200/50 dark:bg-ink-50/50">
          <h3 className="text-sm font-semibold text-ink-100 dark:text-paper-200">Contact Call Status</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-ink-600 dark:text-ink-900 text-[18px]">filter_list</span>
              <input
                className="pl-10 pr-4 py-1.5 border border-paper-600 dark:border-ink-400 rounded text-sm text-ink-100 dark:text-paper-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all placeholder:text-ink-700 dark:placeholder:text-ink-700"
                placeholder="Filter activity..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>
            <IconButton tone="neutral" size="md" title="Download" icon="download"  />
            <FullscreenButton toggle={toggle} isFs={isFs} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-paper-200 dark:bg-ink-50 border-b border-paper-400 dark:border-ink-400">
              <tr>
                {['Name','Phone','Tags / Overrides','Called At','Status','Duration','Call Details'].map(h => (
                  <th key={h} className="px-6 py-4 text-xs text-ink-600 dark:text-ink-900 ">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-paper-400 dark:divide-ink-400">
              {paginated.map(({ cc, log }, i) => {
                const contact = cc.contact;
                const name = cc.overrides?.name || contact?.name || '?';
                const initials = getInitials(name);
                const colorClass = INITIALS_COLORS[i % INITIALS_COLORS.length];
                const status = log?.status;
                const durationMs = log?.durationMs;
                const durationStr = durationMs
                  ? `${Math.floor(durationMs/60000)}m ${Math.round((durationMs%60000)/1000)}s`
                  : '—';

                return (
                  <tr key={log?.id || cc.id} className="hover:bg-paper-200/80 dark:hover:bg-ink-400/50 transition-colors">
                    <td className="px-7 py-5">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center font-bold text-xs ${colorClass}`}>{initials}</div>
                        <span className="text-sm font-medium text-ink-100 dark:text-paper-200">{name}</span>
                      </div>
                    </td>
                    <td className="px-7 py-5 text-sm text-ink-600 dark:text-ink-900">
                      {contact?.phone || '—'}
                    </td>
                    <td className="px-7 py-5">
                      <div className="flex flex-wrap gap-2">
                        {cc.overrides?.tag && (
                          <span className="px-2 py-0.5 bg-brand-100/60 dark:bg-brand-500/15 text-brand-500 dark:text-brand-300 rounded-full text-xs border border-brand-300 dark:border-brand-500/30">{cc.overrides.tag}</span>
                        )}
                        {cc.overrides?.goals && (
                          <span className="px-2 py-0.5 bg-paper-400 dark:bg-ink-300 text-ink-500 dark:text-ink-900 rounded-full text-xs border border-paper-500 dark:border-ink-400">Script Override</span>
                        )}
                      </div>
                    </td>
                    <td className="px-7 py-5 text-sm text-ink-600 dark:text-ink-900">
                      {log?.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-7 py-5">
                      {status ? (
                        <StatusBadge status={status} />
                      ) : (
                        <span className="text-xs text-ink-700 dark:text-ink-900 italic">No call</span>
                      )}
                    </td>
                    <td className="px-7 py-5 text-sm text-ink-600 dark:text-ink-900">{durationStr}</td>
                    <td className="px-7 py-5">
                      {log ? (
                        <Link
                          to={`/campaign/${id}/calls/${log.id}`}
                          className="flex items-center gap-1.5 text-brand-500 hover:text-brand-600 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">article</span>
                          <span className="text-sm">View Call</span>
                        </Link>
                      ) : (
                        <span className="text-xs text-ink-900 dark:text-ink-700 italic">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-sm text-ink-700 dark:text-ink-900">
                    {searchQuery ? 'No contacts match your search.' : 'No contacts in this campaign.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          totalRows={filteredRows.length}
          pageSize={isFs ? 0 : PER_PAGE}
          onPageChange={setPage}
          label="contacts"
        />

        </>);
        }}
      </FullscreenTable>

      <Modal isOpen={isSandboxOpen} onClose={() => setIsSandboxOpen(false)} title="AI Sandbox — Live Test" className="max-w-2xl w-full">
        <SandboxAgent campaign={campaign} />
      </Modal>

      {showShare && <ShareModal campaignId={id} onClose={() => setShowShare(false)} />}
  </Page>
  );
}
