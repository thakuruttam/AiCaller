import React, { useEffect, useState, useRef } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import DebouncedSearch from '../components/DebouncedSearch';
import FullscreenTable, { FullscreenButton } from '../components/FullscreenTable';

const STATUS_BADGE = {
  completed:    'bg-emerald-50 text-emerald-700',
  failed:       'bg-[#ffdad6] text-[#ba1a1a]',
  cancelled:    'bg-orange-50 text-orange-700',
  'in-progress':'bg-blue-50 text-blue-700',
  queued:       'bg-zinc-100 text-zinc-600',
};

const TICKET_STATUS_BADGE = {
  OPEN:        'bg-blue-50 text-blue-700 border border-blue-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border border-amber-200',
  RESOLVED:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
  CLOSED:      'bg-zinc-100 text-zinc-500 border border-zinc-200',
};

export default function AdminDashboard() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [campaignSearchQuery, setCampaignSearchQuery] = useState('');
  const [callSearchQueries, setCallSearchQueries] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [activeTab, setActiveTab] = useState('campaigns');
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketFilter, setTicketFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketReply, setTicketReply] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const { addToast } = useToast();

  const fetchTickets = async () => {
    setTicketsLoading(true);
    try {
      const res = await api.get('/api/support');
      setTickets(res.data.tickets || []);
    } catch { addToast('Failed to load support tickets', 'error'); }
    finally { setTicketsLoading(false); }
  };

  const openTicket = async (t) => {
    try {
      const res = await api.get(`/api/support/${t.id}`);
      setSelectedTicket(res.data);
      setTicketReply('');
    } catch { addToast('Failed to load ticket', 'error'); }
  };

  const sendReply = async () => {
    if (!ticketReply.trim() || !selectedTicket) return;
    setReplyLoading(true);
    try {
      await api.post(`/api/support/${selectedTicket.id}/reply`, { message: ticketReply });
      const res = await api.get(`/api/support/${selectedTicket.id}`);
      setSelectedTicket(res.data);
      setTicketReply('');
      fetchTickets();
      addToast('Reply sent', 'success');
    } catch { addToast('Failed to send reply', 'error'); }
    finally { setReplyLoading(false); }
  };

  const updateTicketStatus = async (ticketId, status) => {
    setStatusLoading(true);
    try {
      await api.patch(`/api/support/${ticketId}/status`, { status });
      const res = await api.get(`/api/support/${ticketId}`);
      setSelectedTicket(res.data);
      fetchTickets();
      addToast(`Ticket marked as ${status.replace('_', ' ').toLowerCase()}`, 'success');
    } catch { addToast('Failed to update status', 'error'); }
    finally { setStatusLoading(false); }
  };

  useEffect(() => {
    fetchCampaigns();
    fetchTickets();
    const pollInterval = setInterval(fetchCampaigns, 3000);
    const clockInterval = setInterval(() => {
      setSecondsAgo(prev => prev + 1);
    }, 1000);
    return () => { clearInterval(pollInterval); clearInterval(clockInterval); };
  }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await api.get('/api/campaigns?all=true');
      setCampaigns(res.data);
      setLastUpdated(Date.now());
      setSecondsAgo(0);
    } catch (e) {
      console.error(e);
      addToast("Failed to load campaigns", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCampaignAction = async (campaignId, action) => {
    try {
      setActionLoading(true);
      await api.post(`/api/campaigns/${campaignId}/status`, { action });
      addToast(`Campaign ${action} executed`, "success");
      await fetchCampaigns();
    } catch (e) {
      addToast(`Failed to ${action} campaign`, "error");
    } finally {
      setActionLoading(false);
      setIsConfirmOpen(false);
    }
  };

  const handleCallAction = async (callId, actionStr) => {
    try {
      setActionLoading(true);
      if (actionStr === 'evaluate') {
        await api.post(`/api/campaigns/calls/${callId}/evaluate`);
        addToast("Call evaluation queued", "success");
      } else if (actionStr === 'recall') {
        await api.post(`/api/campaigns/calls/${callId}/recall`);
        addToast("Re-call queued", "success");
      }
      await fetchCampaigns();
    } catch (e) {
      addToast(`Failed to ${actionStr} call`, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkEvaluate = async (campaign) => {
    const calls = (campaign.callLogs || []).filter(l => l.status === 'completed');
    if (!calls.length) { addToast("No completed calls to evaluate", "info"); return; }
    setActionLoading(true);
    let ok = 0;
    for (const call of calls) {
      try { await api.post(`/api/campaigns/calls/${call.id}/evaluate`); ok++; } catch {}
    }
    setActionLoading(false);
    addToast(`Queued ${ok} of ${calls.length} evaluations`, "success");
  };

  const handleBulkRecall = async (campaign) => {
    const calls = (campaign.callLogs || []).filter(l => ['failed','cancelled'].includes(l.status));
    if (!calls.length) { addToast("No failed calls to re-call", "info"); return; }
    setActionLoading(true);
    let ok = 0;
    for (const call of calls) {
      try { await api.post(`/api/campaigns/calls/${call.id}/recall`); ok++; } catch {}
    }
    setActionLoading(false);
    addToast(`Queued ${ok} of ${calls.length} re-calls`, "success");
    await fetchCampaigns();
  };

  const confirmRerun = (campaignId) => { setConfirmAction(campaignId); setIsConfirmOpen(true); };
  const toggleCampaign = (id) => setExpandedCampaignId(prev => prev === id ? null : id);
  const handleCallSearch = (campaignId, query) => setCallSearchQueries(prev => ({ ...prev, [campaignId]: query }));

  const STALE_MS = 10 * 60 * 1000;
  const isLiveLog = (l) => {
    if (!['queued','in-progress'].includes(l.status)) return false;
    return Date.now() - new Date(l.updatedAt || l.createdAt).getTime() < STALE_MS;
  };
  const totalActive = campaigns.filter(c => (c.callLogs||[]).some(isLiveLog)).length;
  const totalPaused = campaigns.filter(c => (c.callLogs||[]).some(l => l.status === 'paused')).length;
  const totalCPS = (campaigns.reduce((a,c) => a + (c.callLogs||[]).filter(isLiveLog).length, 0) * 0.7).toFixed(1);
  const totalChannels = campaigns.reduce((a,c) => a + (c.callLogs||[]).filter(isLiveLog).length, 0);

  const filtered = campaigns.filter(c => c.name?.toLowerCase().includes(campaignSearchQuery.toLowerCase()));

  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[#0d9488] text-3xl">shield</span>
            <h2 className="text-3xl font-semibold text-[#0f172a] tracking-tight">Admin Dashboard</h2>
          </div>
          <p className="text-[#334155] text-base">Real-time system oversight and campaign orchestration.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              if (window.confirm('CRITICAL ACTION: Kill all active campaigns?')) {
                campaigns.forEach(c => {
                  if ((c.callLogs||[]).some(l => ['queued','in-progress'].includes(l.status))) {
                    handleCampaignAction(c.id, 'kill');
                  }
                });
              }
            }}
            className="bg-[#ba1a1a] text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm hover:bg-red-700 transition-colors shadow-sm active:scale-95"
            style={{fontFamily:'JetBrains Mono, monospace'}}
          >
            <span className="material-symbols-outlined text-[18px]">skull</span>
            Kill All
          </button>
          <button className="bg-zinc-100 text-zinc-900 px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm border border-zinc-200 hover:bg-zinc-200 transition-colors" style={{fontFamily:'JetBrains Mono, monospace'}}>
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Logs
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 bg-zinc-100 p-1 rounded-xl w-fit">
        {[
          { key: 'campaigns', icon: 'campaign', label: 'Campaigns' },
          { key: 'support', icon: 'contact_support', label: `Support Tickets${tickets.filter(t => t.status === 'OPEN').length > 0 ? ` (${tickets.filter(t => t.status === 'OPEN').length})` : ''}` },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            style={{fontFamily:'JetBrains Mono, monospace'}}
          >
            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'support' && (
        <SupportTicketsPanel
          tickets={tickets}
          loading={ticketsLoading}
          filter={ticketFilter}
          setFilter={setTicketFilter}
          onRefresh={fetchTickets}
          onOpen={openTicket}
          selectedTicket={selectedTicket}
          onCloseTicket={() => { setSelectedTicket(null); fetchTickets(); }}
          ticketReply={ticketReply}
          setTicketReply={setTicketReply}
          onSendReply={sendReply}
          replyLoading={replyLoading}
          onUpdateStatus={updateTicketStatus}
          statusLoading={statusLoading}
        />
      )}

      {activeTab === 'campaigns' && (<>
      {/* Metrics Bento */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-12 md:col-span-3 bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
          <p className="text-xs text-[#334155] mb-1 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Active Channels</p>
          <h3 className="text-2xl font-semibold text-[#0f172a]">{totalChannels} / 2,000</h3>
          <div className="w-full bg-zinc-100 h-1.5 rounded-full mt-3">
            <div className="bg-[#0d9488] h-1.5 rounded-full" style={{width:`${Math.min(100, (totalChannels/2000)*100)}%`}}></div>
          </div>
        </div>
        <div className="col-span-12 md:col-span-3 bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
          <p className="text-xs text-[#334155] mb-1 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Calls per Second</p>
          <h3 className="text-2xl font-semibold text-[#0f172a]">{totalCPS} CPS</h3>
          <p className="text-emerald-600 text-xs flex items-center gap-1 mt-2" style={{fontFamily:'JetBrains Mono, monospace'}}>
            <span className="material-symbols-outlined text-sm">trending_up</span> Live feed
          </p>
        </div>
        <div className="col-span-12 md:col-span-3 bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
          <p className="text-xs text-[#334155] mb-1 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>System Latency</p>
          <h3 className="text-2xl font-semibold text-[#0f172a]">142ms</h3>
          <p className="text-zinc-500 text-xs flex items-center gap-1 mt-2" style={{fontFamily:'JetBrains Mono, monospace'}}>
            <span className="material-symbols-outlined text-sm">check_circle</span> Within SLA
          </p>
        </div>
        <div className="col-span-12 md:col-span-3 bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
          <p className="text-xs text-[#334155] mb-1 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Error Rate</p>
          <h3 className="text-2xl font-semibold text-[#0f172a]">0.04%</h3>
          <p className="text-zinc-500 text-xs flex items-center gap-1 mt-2" style={{fontFamily:'JetBrains Mono, monospace'}}>
            <span className="material-symbols-outlined text-sm">info</span> Low impact
          </p>
        </div>
      </div>

      {/* Campaign Table */}
      <FullscreenTable className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden mb-6">
        {({ toggle, isFs }) => (<>
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h4 className="text-base font-semibold text-[#0f172a]">All Campaigns</h4>
            <span className="flex items-center gap-1.5 text-xs text-zinc-400" style={{fontFamily:'JetBrains Mono, monospace'}}>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {secondsAgo === 0 ? 'Live' : `${secondsAgo}s ago`}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800" style={{fontFamily:'JetBrains Mono, monospace'}}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
              {totalActive} Active
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800" style={{fontFamily:'JetBrains Mono, monospace'}}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
              {totalPaused} Paused
            </span>
            <FullscreenButton toggle={toggle} isFs={isFs} />
          </div>
        </div>

        <div className="px-6 py-3 border-b border-zinc-100">
          <DebouncedSearch onSearch={setCampaignSearchQuery} placeholder="Search campaigns..." className="w-72" />
        </div>

        <div className="divide-y divide-zinc-100">
          {loading && (
            <div className="px-6 py-10 flex flex-col items-center gap-3">
              <Spinner size={28} className="text-[#0d9488]" />
              <p className="text-sm text-[#64748b]" style={{fontFamily:'JetBrains Mono, monospace'}}>Loading campaigns…</p>
            </div>
          )}
          {!loading && filtered.map(campaign => {
            const logs = campaign.callLogs || [];
            const STALE_MS = 10 * 60 * 1000; // 10 min — in-progress/queued older than this is a ghost
            const effectiveStatus = (log) => {
              if (['in-progress', 'queued'].includes(log.status)) {
                const age = Date.now() - new Date(log.updatedAt || log.createdAt).getTime();
                if (age > STALE_MS) return 'completed'; // treat as done
              }
              return log.status;
            };
            const statuses = logs.map(effectiveStatus);
            const terminalStatuses = ['completed', 'failed', 'cancelled'];
            const hasDraft = statuses.includes('draft');
            const hasQueued = statuses.includes('queued');
            const hasInProgress = statuses.includes('in-progress');
            const hasPaused = statuses.includes('paused');
            const allTerminal = logs.length > 0 && statuses.every(s => terminalStatuses.includes(s));
            const hasActive = !allTerminal && (hasQueued || hasInProgress || hasPaused);
            const hasEverRun = statuses.some(s => terminalStatuses.includes(s));
            const isExpanded = expandedCampaignId === campaign.id;

            return (
              <div key={campaign.id} className="group">
                <div className="flex items-center px-6 py-4 cursor-pointer hover:bg-zinc-50/30 transition-colors" onClick={() => toggleCampaign(campaign.id)}>
                  <div className="w-8 flex-shrink-0">
                    <span className={`material-symbols-outlined text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                  </div>
                  <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3">
                      <p className="text-sm font-medium text-zinc-900" style={{fontFamily:'JetBrains Mono, monospace'}}>{campaign.name}</p>
                      <p className="text-xs text-zinc-500" style={{fontFamily:'JetBrains Mono, monospace'}}>ID: {campaign.id?.substring(0,12)}</p>
                    </div>
                    <div className="col-span-3">
                      <p className="text-xs text-zinc-500 uppercase" style={{fontFamily:'JetBrains Mono, monospace'}}>Workspace</p>
                      <p className="text-sm font-medium text-zinc-900 truncate" style={{fontFamily:'JetBrains Mono, monospace'}}>{campaign.tenant?.name || '—'}</p>
                      <p className="text-[10px] text-zinc-400 truncate" style={{fontFamily:'JetBrains Mono, monospace'}}>{campaign.createdBy?.email || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-zinc-500 uppercase" style={{fontFamily:'JetBrains Mono, monospace'}}>Calls</p>
                      <p className="text-sm font-medium text-zinc-900" style={{fontFamily:'JetBrains Mono, monospace'}}>{logs.length.toLocaleString()}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-xs text-zinc-500 uppercase" style={{fontFamily:'JetBrains Mono, monospace'}}>Type</p>
                      <p className="text-sm font-medium text-zinc-900 capitalize" style={{fontFamily:'JetBrains Mono, monospace'}}>{campaign.type || 'HR'}</p>
                    </div>
                    <div className="col-span-3 flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                      {(hasDraft || !logs.length) && (
                        <button onClick={() => handleCampaignAction(campaign.id, 'start')} disabled={actionLoading} className="bg-[#0d9488] text-white p-2 rounded-lg hover:bg-[#0f766e] transition-colors shadow-sm disabled:opacity-50" title="Start">
                          <span className="material-symbols-outlined text-sm">play_arrow</span>
                        </button>
                      )}
                      {(hasQueued || hasInProgress) && (
                        <button onClick={() => handleCampaignAction(campaign.id, 'pause')} disabled={actionLoading} className="bg-zinc-100 text-zinc-600 p-2 rounded-lg hover:bg-zinc-200 transition-colors border border-zinc-200 disabled:opacity-50" title="Pause">
                          <span className="material-symbols-outlined text-sm">pause</span>
                        </button>
                      )}
                      {hasPaused && (
                        <button onClick={() => handleCampaignAction(campaign.id, 'resume')} disabled={actionLoading} className="bg-amber-100 text-amber-700 p-2 rounded-lg hover:bg-amber-200 transition-colors border border-amber-200 disabled:opacity-50" title="Resume">
                          <span className="material-symbols-outlined text-sm">play_circle</span>
                        </button>
                      )}
                      {hasActive && (
                        <button onClick={() => handleCampaignAction(campaign.id, 'kill')} disabled={actionLoading} className="bg-zinc-100 text-[#ba1a1a] p-2 rounded-lg hover:bg-[#ffdad6] transition-colors border border-zinc-200 disabled:opacity-50" title="Kill">
                          <span className="material-symbols-outlined text-sm">stop</span>
                        </button>
                      )}
                      {hasEverRun && (
                        <button onClick={() => confirmRerun(campaign.id)} disabled={actionLoading} className="bg-zinc-100 text-zinc-600 p-2 rounded-lg hover:bg-zinc-200 transition-colors border border-zinc-200 disabled:opacity-50" title="Re-run">
                          <span className="material-symbols-outlined text-sm">refresh</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-zinc-50/80 px-14 border-t border-zinc-100">
                    <div className="py-6">
                      <div className="flex justify-between items-center mb-4">
                        <h5 className="text-sm font-medium text-zinc-700" style={{fontFamily:'JetBrains Mono, monospace'}}>Live Call Stream</h5>
                        <div className="flex items-center gap-3">
                          <DebouncedSearch onSearch={(q) => handleCallSearch(campaign.id, q)} placeholder="Search call logs..." className="w-64" />
                          <button onClick={() => handleBulkEvaluate(campaign)} disabled={actionLoading} className="text-xs px-3 py-1.5 border border-zinc-200 rounded-md bg-white hover:bg-zinc-50 text-zinc-700 transition-colors disabled:opacity-50" style={{fontFamily:'JetBrains Mono, monospace'}}>Evaluate All</button>
                          <button onClick={() => handleBulkRecall(campaign)} disabled={actionLoading} className="text-xs px-3 py-1.5 border border-zinc-200 rounded-md bg-white hover:bg-zinc-50 text-zinc-700 transition-colors disabled:opacity-50" style={{fontFamily:'JetBrains Mono, monospace'}}>Re-call Failed</button>
                        </div>
                      </div>
                      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white shadow-sm">
                        <table className="w-full text-left">
                          <thead className="bg-zinc-100 border-b border-zinc-200">
                            <tr>
                              {['Contact','Phone','Status','Actions'].map(h => (
                                <th key={h} className="px-4 py-2 text-xs font-medium text-zinc-600" style={{fontFamily:'JetBrains Mono, monospace'}}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 text-sm">
                            {(campaign.campaignContacts || [])
                              .filter(cc => {
                                const q = callSearchQueries[campaign.id]?.toLowerCase() || '';
                                if (!q) return true;
                                return (cc.overrides?.name || cc.contact?.name || '').toLowerCase().includes(q) ||
                                       (cc.contact?.phone || '').includes(q);
                              })
                              .map(cc => {
                                const log = logs.find(l => l.contactId === cc.contact?.id);
                                const name = cc.overrides?.name || cc.contact?.name;
                                return (
                                  <tr key={cc.id} className="hover:bg-zinc-50">
                                    <td className="px-4 py-3 font-medium text-zinc-900">{name}</td>
                                    <td className="px-4 py-3 text-zinc-500" style={{fontFamily:'JetBrains Mono, monospace'}}>{cc.contact?.phone}</td>
                                    <td className="px-4 py-3">
                                      {log ? (
                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[log.status] || STATUS_BADGE.queued}`} style={{fontFamily:'JetBrains Mono, monospace'}}>
                                          {log.status}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-zinc-400 italic" style={{fontFamily:'JetBrains Mono, monospace'}}>No log</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      {log && (
                                        <div className="flex gap-2">
                                          <button onClick={() => handleCallAction(log.id, 'evaluate')} disabled={actionLoading || log.status !== 'completed'} className="text-[11px] px-2.5 py-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 disabled:opacity-50" style={{fontFamily:'JetBrains Mono, monospace'}}>Eval</button>
                                          <button onClick={() => handleCallAction(log.id, 'recall')} disabled={actionLoading} className="text-[11px] px-2.5 py-1 rounded border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 disabled:opacity-50 flex items-center gap-1" style={{fontFamily:'JetBrains Mono, monospace'}}>
                                            <span className="material-symbols-outlined text-[12px]">history</span> Re-call
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            {(!campaign.campaignContacts || campaign.campaignContacts.length === 0) && (
                              <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-zinc-400 italic">No contacts in this campaign.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {!loading && filtered.length === 0 && (
            <div className="px-6 py-12 text-center text-sm text-[#64748b]" style={{fontFamily:'JetBrains Mono, monospace'}}>No campaigns found.</div>
          )}
        </div>
        </>)}
      </FullscreenTable>


      {/* Re-run confirm modal */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Re-run Campaign?"
        footer={
          <>
            <button onClick={() => setIsConfirmOpen(false)} className="inline-flex items-center justify-center rounded-lg text-sm font-medium h-9 px-4 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 transition-colors">Cancel</button>
            <button onClick={() => handleCampaignAction(confirmAction, 'rerun')} disabled={actionLoading} className="inline-flex items-center justify-center rounded-lg text-sm font-semibold h-9 px-4 bg-[#ba1a1a] text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
              {actionLoading ? 'Processing…' : 'Reset & Rerun'}
            </button>
          </>
        }
      >
        <p className="text-sm text-zinc-600 leading-relaxed">
          Are you sure? This will <strong className="text-zinc-900">permanently delete</strong> all previous transcripts and recordings for this campaign and start fresh.
        </p>
      </Modal>
      </>)}
    </div>
  );
}

const ROLE_BADGE = {
  SUPER_ADMIN: 'bg-[#ffdad6] text-[#ba1a1a]',
  ADMIN:       'bg-[#0d9488]/10 text-[#0d9488]',
  EDITOR:      'bg-amber-50 text-amber-700',
  VIEWER:      'bg-zinc-100 text-zinc-600',
};

const STATUS_USER_BADGE = {
  ACTIVE:    'bg-emerald-50 text-emerald-700',
  PENDING:   'bg-amber-50 text-amber-700',
  SUSPENDED: 'bg-[#ffdad6] text-[#ba1a1a]',
};

function Avatar({ user, size = 'md' }) {
  const dim = size === 'lg' ? 'w-14 h-14 text-base' : size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
  return (
    <div className={`${dim} rounded-full bg-[#0f766e] flex items-center justify-center text-white font-bold shrink-0 overflow-hidden`}>
      {user?.avatarUrl
        ? <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
        : user?.name?.charAt(0)?.toUpperCase() || '?'}
    </div>
  );
}

function SupportTicketsPanel({ tickets, loading, filter, setFilter, onRefresh, onOpen, selectedTicket, onCloseTicket, ticketReply, setTicketReply, onSendReply, replyLoading, onUpdateStatus, statusLoading }) {
  const FILTERS = ['all', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);

  const openCount    = tickets.filter(t => t.status === 'OPEN').length;
  const ipCount      = tickets.filter(t => t.status === 'IN_PROGRESS').length;
  const resolveCount = tickets.filter(t => t.status === 'RESOLVED').length;

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono mb-1">Open</p>
          <p className="text-2xl font-bold text-blue-600">{openCount}</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono mb-1">In Progress</p>
          <p className="text-2xl font-bold text-amber-600">{ipCount}</p>
        </div>
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-sm">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-mono mb-1">Resolved</p>
          <p className="text-2xl font-bold text-emerald-600">{resolveCount}</p>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* ── Ticket list ── */}
        <div className={`${selectedTicket ? 'w-[360px] shrink-0' : 'flex-1'} bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden`}>
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex gap-0.5 bg-zinc-100 p-0.5 rounded-lg">
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${filter === f ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                  style={{fontFamily:'JetBrains Mono, monospace'}}
                >
                  {f === 'all' ? 'All' : f.replace('_', ' ')}
                </button>
              ))}
            </div>
            <button onClick={onRefresh} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
              <span className="material-symbols-outlined text-zinc-400 text-[16px]">refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="px-5 py-10 text-center text-zinc-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <span className="material-symbols-outlined text-zinc-200 text-[40px] block mb-2">inbox</span>
              <p className="text-zinc-400 text-sm">No tickets</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-50 max-h-[65vh] overflow-y-auto">
              {filtered.map(t => (
                <div
                  key={t.id}
                  onClick={() => onOpen(t)}
                  className={`px-4 py-3.5 cursor-pointer hover:bg-zinc-50 transition-colors ${selectedTicket?.id === t.id ? 'bg-zinc-50 border-l-[3px] border-[#0d9488]' : 'border-l-[3px] border-transparent'}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar user={t.user} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-zinc-900 truncate leading-tight">{t.subject}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${TICKET_STATUS_BADGE[t.status]}`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{t.user?.name} · {t.tenant?.name || 'No workspace'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-zinc-400 capitalize font-mono">{t.category}</span>
                        <span className="text-[10px] text-zinc-300">·</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{new Date(t.createdAt).toLocaleDateString()}</span>
                        {t._count?.replies > 0 && <>
                          <span className="text-[10px] text-zinc-300">·</span>
                          <span className="text-[10px] text-zinc-400">{t._count.replies} {t._count.replies === 1 ? 'reply' : 'replies'}</span>
                        </>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Ticket detail ── */}
        {selectedTicket && (
          <div className="flex-1 flex gap-4 items-start min-w-0">

            {/* Sender card */}
            <div className="w-[220px] shrink-0 bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">Submitted by</p>
              </div>
              <div className="p-4 space-y-4">
                {/* Avatar + name */}
                <div className="flex flex-col items-center text-center gap-2">
                  <Avatar user={selectedTicket.user} size="lg" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 leading-tight">{selectedTicket.user?.name}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5 break-all">{selectedTicket.user?.email}</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {selectedTicket.user?.role && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[selectedTicket.user.role] || 'bg-zinc-100 text-zinc-600'}`}>
                        {selectedTicket.user.role.replace('_', ' ')}
                      </span>
                    )}
                    {selectedTicket.user?.status && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_USER_BADGE[selectedTicket.user.status] || 'bg-zinc-100 text-zinc-500'}`}>
                        {selectedTicket.user.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Detail rows */}
                <div className="space-y-2.5 border-t border-zinc-100 pt-3">
                  {selectedTicket.tenant?.name && (
                    <div>
                      <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">Workspace</p>
                      <p className="text-xs text-zinc-700 font-medium mt-0.5">{selectedTicket.tenant.name}</p>
                    </div>
                  )}
                  {selectedTicket.submitterContext?.workspaceRole && (
                    <div>
                      <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">Workspace Role</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 inline-block ${ROLE_BADGE[selectedTicket.submitterContext.workspaceRole] || 'bg-zinc-100 text-zinc-600'}`}>
                        {selectedTicket.submitterContext.workspaceRole}
                      </span>
                    </div>
                  )}
                  {selectedTicket.submitterContext?.workspaceMemberSince && (
                    <div>
                      <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">Member Since</p>
                      <p className="text-xs text-zinc-600 mt-0.5">{new Date(selectedTicket.submitterContext.workspaceMemberSince).toLocaleDateString()}</p>
                    </div>
                  )}
                  {selectedTicket.user?.createdAt && (
                    <div>
                      <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">Account Created</p>
                      <p className="text-xs text-zinc-600 mt-0.5">{new Date(selectedTicket.user.createdAt).toLocaleDateString()}</p>
                    </div>
                  )}
                  {selectedTicket.submitterContext?.totalTickets != null && (
                    <div>
                      <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">Total Tickets</p>
                      <p className="text-xs font-semibold text-zinc-700 mt-0.5">{selectedTicket.submitterContext.totalTickets}</p>
                    </div>
                  )}
                </div>

                {/* Ticket meta */}
                <div className="space-y-2.5 border-t border-zinc-100 pt-3">
                  <div>
                    <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">Category</p>
                    <p className="text-xs text-zinc-700 capitalize mt-0.5">{selectedTicket.category.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">Opened</p>
                    <p className="text-xs text-zinc-600 mt-0.5">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider font-mono">Status</p>
                    <select
                      value={selectedTicket.status}
                      onChange={e => onUpdateStatus(selectedTicket.id, e.target.value)}
                      disabled={statusLoading}
                      className="mt-0.5 w-full text-xs border border-zinc-200 rounded-lg px-2 py-1.5 bg-white font-mono outline-none focus:ring-2 focus:ring-[#0d9488]"
                    >
                      {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(s => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Conversation panel */}
            <div className="flex-1 bg-white border border-zinc-200 rounded-xl shadow-sm flex flex-col min-w-0" style={{maxHeight: '72vh'}}>
              {/* Header */}
              <div className="px-5 py-4 border-b border-zinc-100 flex items-start justify-between shrink-0">
                <div className="min-w-0 pr-3">
                  <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider capitalize">{selectedTicket.category.replace('_', ' ')}</p>
                  <h3 className="text-sm font-semibold text-zinc-900 mt-0.5 leading-snug">{selectedTicket.subject}</h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedTicket.status === 'CLOSED' ? (
                    <button
                      onClick={() => onUpdateStatus(selectedTicket.id, 'OPEN')}
                      disabled={statusLoading}
                      className="text-[11px] font-semibold px-3 py-1 rounded-lg border border-[#0d9488] text-[#0d9488] hover:bg-[#ede9fe] disabled:opacity-50 transition-colors"
                    >
                      Reopen
                    </button>
                  ) : (
                    <button
                      onClick={() => onUpdateStatus(selectedTicket.id, 'CLOSED')}
                      disabled={statusLoading}
                      className="text-[11px] font-semibold px-3 py-1 rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50 transition-colors"
                    >
                      Close
                    </button>
                  )}
                  <button onClick={onCloseTicket} className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors">
                    <span className="material-symbols-outlined text-zinc-400 text-[18px]">close</span>
                  </button>
                </div>
              </div>

              {/* Thread */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Original message */}
                <div className="flex gap-3">
                  <Avatar user={selectedTicket.user} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-xs font-semibold text-zinc-800">{selectedTicket.user?.name}</p>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${ROLE_BADGE[selectedTicket.user?.role] || 'bg-zinc-100 text-zinc-600'}`}>
                        {selectedTicket.user?.role?.replace('_', ' ')}
                      </span>
                      <p className="text-[10px] text-zinc-400 font-mono ml-auto">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="bg-zinc-50 rounded-xl rounded-tl-sm p-4 text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                      {selectedTicket.message}
                    </div>
                  </div>
                </div>

                {/* Replies */}
                {(selectedTicket.replies || []).map(r => (
                  <div key={r.id} className={`flex gap-3 ${r.isAdmin ? 'flex-row-reverse' : ''}`}>
                    <Avatar user={r.user} size="sm" />
                    <div className={`flex-1 ${r.isAdmin ? 'items-end' : ''}`}>
                      <div className={`flex items-center gap-2 mb-1.5 ${r.isAdmin ? 'flex-row-reverse' : ''}`}>
                        <p className="text-xs font-semibold text-zinc-800">{r.user?.name}</p>
                        {r.isAdmin && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#0d9488]/10 text-[#0d9488]">Support</span>
                        )}
                        <p className="text-[10px] text-zinc-400 font-mono">{new Date(r.createdAt).toLocaleString()}</p>
                      </div>
                      <div className={`rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap ${r.isAdmin ? 'bg-[#ede9fe] text-[#0d9488] rounded-tr-sm' : 'bg-zinc-50 text-zinc-700 rounded-tl-sm'}`}>
                        {r.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              {selectedTicket.status !== 'CLOSED' && (
                <div className="p-4 border-t border-zinc-100 shrink-0">
                  <div className="flex gap-3">
                    <textarea
                      value={ticketReply}
                      onChange={e => setTicketReply(e.target.value)}
                      placeholder="Reply to this ticket…"
                      rows={3}
                      className="flex-1 text-sm bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 resize-none outline-none focus:ring-2 focus:ring-[#0d9488] text-zinc-800 placeholder:text-zinc-400"
                    />
                    <button
                      onClick={onSendReply}
                      disabled={replyLoading || !ticketReply.trim()}
                      className="self-end bg-[#0d9488] hover:bg-[#0f766e] disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    >
                      {replyLoading ? 'Sending…' : 'Reply'}
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
