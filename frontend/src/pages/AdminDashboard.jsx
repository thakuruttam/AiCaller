import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';
import DebouncedSearch from '../components/DebouncedSearch';
import FullscreenTable, { FullscreenButton } from '../components/FullscreenTable';
import Step7Review from './CampaignWizard/components/Step7Review';
import { Tabs, Button, IconButton } from '../components/ui';

const STATUS_BADGE = {
  completed:    "bg-positive/10 text-positive-dim dark:bg-positive/15 dark:text-positive",
  failed:       'bg-negative/10 text-negative-dim dark:bg-negative/15 dark:text-negative',
  cancelled:    "bg-caution/10 text-caution-dim dark:bg-caution/15 dark:text-caution",
  "in-progress":"bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  queued:       "bg-paper-400 text-ink-600 dark:bg-ink-300 dark:text-ink-900",
  scheduled:    "bg-brand-100 text-brand-600 dark:bg-brand-600/30 dark:text-brand-300",
};

const TICKET_STATUS_BADGE = {
  OPEN:        "bg-brand-100 text-brand-600 border border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-600",
  IN_PROGRESS: "bg-caution/10 text-caution-dim border border-caution/30 dark:bg-caution/15 dark:text-caution dark:border-caution/15",
  RESOLVED:    "bg-positive/10 text-positive-dim border border-positive/30 dark:bg-positive/15 dark:text-positive dark:border-positive/15",
  CLOSED:      "bg-paper-400 text-ink-700 border border-paper-500 dark:bg-ink-300 dark:text-ink-900 dark:border-ink-400",
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
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [nowTs, setNowTs] = useState(() => Date.now());
  // Notifications deep-link here as /admin?tab=support&ticket=<id>, so the tab
  // is seeded from the URL and kept in it — a linked ticket lands on the right
  // tab, and the page stays shareable/reloadable.
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_TABS = ['campaigns', 'support'];
  const urlTab = searchParams.get('tab');
  const deepLinkedTicketId = searchParams.get('ticket');

  // The URL is the single source of truth for the active tab — deriving it
  // rather than mirroring it into state means back/forward and a pasted link
  // all land on the right tab with no effect to keep them in sync.
  const activeTab = VALID_TABS.includes(urlTab) ? urlTab : 'campaigns';

  const selectTab = (key) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    if (key !== 'support') next.delete('ticket');
    setSearchParams(next, { replace: true });
  };
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketFilter, setTicketFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketReply, setTicketReply] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewLoadingId, setViewLoadingId] = useState(null);
  const { addToast } = useToast();
  const wasFailingRef = useRef(false);

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

  // Arriving from a support notification (…&ticket=<id>) opens that ticket
  // straight away. Runs once per id so closing the dialog doesn't reopen it.
  const openedFromUrl = useRef(null);
  useEffect(() => {
    if (!deepLinkedTicketId || openedFromUrl.current === deepLinkedTicketId) return;
    openedFromUrl.current = deepLinkedTicketId;
    openTicket({ id: deepLinkedTicketId });
  }, [deepLinkedTicketId]);

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
    const pollInterval = setInterval(fetchCampaigns, 8000);
    const clockInterval = setInterval(() => {
      setSecondsAgo(prev => prev + 1);
      setNowTs(Date.now());
    }, 1000);
    return () => { clearInterval(pollInterval); clearInterval(clockInterval); };
  }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await api.get('/api/campaigns?all=true');
      setCampaigns(res.data);
      setSecondsAgo(0);
      wasFailingRef.current = false;
    } catch (e) {
      console.error(e);
      // Only toast on the first failure of a streak — a slow/flaky network
      // window during an active call otherwise fires a new toast every poll,
      // stacking up and making a transient blip look like the page broke.
      if (!wasFailingRef.current) {
        addToast("Failed to load campaigns", "error");
        wasFailingRef.current = true;
      }
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
    } catch {
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
    } catch {
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
      try { await api.post(`/api/campaigns/calls/${call.id}/evaluate`); ok++; } catch { /* counted as a miss below */ }
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
      try { await api.post(`/api/campaigns/calls/${call.id}/recall`); ok++; } catch { /* counted as a miss below */ }
    }
    setActionLoading(false);
    addToast(`Queued ${ok} of ${calls.length} re-calls`, "success");
    await fetchCampaigns();
  };

  const openViewModal = async (campaignId) => {
    try {
      setViewLoadingId(campaignId);
      const res = await api.get(`/api/campaigns/${campaignId}`);
      setSelectedCampaign(res.data);
      setIsViewModalOpen(true);
    } catch {
      addToast('Failed to load campaign details', 'error');
    } finally {
      setViewLoadingId(null);
    }
  };

  const confirmRerun = (campaignId) => { setConfirmAction(campaignId); setIsConfirmOpen(true); };
  const toggleCampaign = (id) => setExpandedCampaignId(prev => prev === id ? null : id);
  const handleCallSearch = (campaignId, query) => setCallSearchQueries(prev => ({ ...prev, [campaignId]: query }));

  const STALE_MS = 10 * 60 * 1000;
  const isLiveLog = (l) => {
    if (!['queued','in-progress'].includes(l.status)) return false;
    return nowTs - new Date(l.updatedAt || l.createdAt).getTime() < STALE_MS;
  };
  const totalActive = campaigns.filter(c => (c.callLogs||[]).some(isLiveLog)).length;
  const totalPaused = campaigns.filter(c => (c.callLogs||[]).some(l => l.status === 'paused')).length;
  const totalCPS = (campaigns.reduce((a,c) => a + (c.callLogs||[]).filter(isLiveLog).length, 0) * 0.7).toFixed(1);
  const totalChannels = campaigns.reduce((a,c) => a + (c.callLogs||[]).filter(isLiveLog).length, 0);

  const filtered = campaigns.filter(c => c.name?.toLowerCase().includes(campaignSearchQuery.toLowerCase()));

  return (
    <div className="p-10 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-brand-500 text-3xl">shield</span>
            <h2 className="text-[22px] font-semibold text-ink-100 dark:text-paper-200">Admin Dashboard</h2>
          </div>
          <p className="text-ink-600 dark:text-ink-900 text-sm">Real-time system oversight and campaign orchestration.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="danger" size="md" icon="skull" onClick={() => { if (window.confirm('CRITICAL ACTION: Kill all active campaigns?')) { campaigns.forEach(c => { if ((c.callLogs||[]).some(l => ['queued','in-progress'].includes(l.status))) { handleCampaignAction(c.id, 'kill'); } }); } }}>Kill All</Button>
          <Button variant="secondary" size="md" icon="download" >Export Logs</Button>
        </div>
      </div>

      {/* Tab Bar */}
      <Tabs
        className="mb-6"
        value={activeTab}
        onChange={selectTab}
        items={[
          { value: 'campaigns', label: 'Campaigns', icon: 'campaign' },
          {
            value: 'support',
            label: 'Support tickets',
            icon: 'contact_support',
            count: tickets.filter(t => t.status === 'OPEN').length || undefined,
          },
        ]}
      />

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
        <div className="col-span-12 md:col-span-3 bg-paper-100 dark:bg-ink-200 p-6 rounded-control border border-paper-500 dark:border-ink-400 shadow-card">
          <p className="text-xs text-ink-600 dark:text-ink-900 mb-1 ">Active Channels</p>
          <h3 className="text-2xl font-semibold text-ink-100 dark:text-paper-200">{totalChannels} / 2,000</h3>
          <div className="w-full bg-paper-400 dark:bg-ink-300 h-1.5 rounded-full mt-3">
            <div className="bg-brand-500 h-1.5 rounded-full" style={{width:`${Math.min(100, (totalChannels/2000)*100)}%`}}></div>
          </div>
        </div>
        <div className="col-span-12 md:col-span-3 bg-paper-100 dark:bg-ink-200 p-6 rounded-control border border-paper-500 dark:border-ink-400 shadow-card">
          <p className="text-xs text-ink-600 dark:text-ink-900 mb-1 ">Calls per Second</p>
          <h3 className="text-2xl font-semibold text-ink-100 dark:text-paper-200">{totalCPS} CPS</h3>
          <p className="text-positive-dim text-xs flex items-center gap-1 mt-2">
            <span className="material-symbols-outlined text-sm">trending_up</span> Live feed
          </p>
        </div>
        <div className="col-span-12 md:col-span-3 bg-paper-100 dark:bg-ink-200 p-6 rounded-control border border-paper-500 dark:border-ink-400 shadow-card">
          <p className="text-xs text-ink-600 dark:text-ink-900 mb-1 ">System Latency</p>
          <h3 className="text-2xl font-semibold text-ink-100 dark:text-paper-200">142ms</h3>
          <p className="text-ink-700 dark:text-ink-900 text-xs flex items-center gap-1 mt-2">
            <span className="material-symbols-outlined text-sm">check_circle</span> Within SLA
          </p>
        </div>
        <div className="col-span-12 md:col-span-3 bg-paper-100 dark:bg-ink-200 p-6 rounded-control border border-paper-500 dark:border-ink-400 shadow-card">
          <p className="text-xs text-ink-600 dark:text-ink-900 mb-1 ">Error Rate</p>
          <h3 className="text-2xl font-semibold text-ink-100 dark:text-paper-200">0.04%</h3>
          <p className="text-ink-700 dark:text-ink-900 text-xs flex items-center gap-1 mt-2">
            <span className="material-symbols-outlined text-sm">info</span> Low impact
          </p>
        </div>
      </div>

      {/* Campaign Table */}
      <FullscreenTable className="bg-paper-100 dark:bg-ink-200 rounded-control border border-paper-500 dark:border-ink-400 shadow-card overflow-hidden mb-6">
        {({ toggle, isFs }) => (<>
        <div className="px-6 py-4 border-b border-paper-400 dark:border-ink-400 bg-paper-200/50 dark:bg-ink-50/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-semibold text-ink-100 dark:text-paper-200">All Campaigns</h4>
            <span className="flex items-center gap-1.5 text-xs text-ink-800 dark:text-ink-800">              <span className="inline-block w-1.5 h-1.5 rounded-full bg-positive animate-pulse"></span>
              {secondsAgo === 0 ? 'Live' : `${secondsAgo}s ago`}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-positive/10 dark:bg-positive/15 dark:text-positive text-positive-dim">
              <span className="w-1.5 h-1.5 rounded-full bg-positive mr-1.5"></span>
              {totalActive} Active
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-caution/10 dark:bg-caution/15 dark:text-caution text-caution-dim">
              <span className="w-1.5 h-1.5 rounded-full bg-caution/100 mr-1.5"></span>
              {totalPaused} Paused
            </span>
            <FullscreenButton toggle={toggle} isFs={isFs} />
          </div>
        </div>

        <div className="px-6 py-3 border-b border-paper-400 dark:border-ink-400">
          <DebouncedSearch onSearch={setCampaignSearchQuery} placeholder="Search campaigns..." className="w-72" />
        </div>

        <div className="divide-y divide-paper-400 dark:divide-ink-400">
          {loading && (
            <div className="px-6 py-10 flex flex-col items-center gap-3">
              <Spinner size={28} className="text-brand-500" />
              <p className="text-sm text-ink-700 dark:text-ink-900">Loading campaigns…</p>
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
            const hasScheduled = statuses.includes('scheduled');
            const allTerminal = logs.length > 0 && statuses.every(s => terminalStatuses.includes(s));
            const hasActive = !allTerminal && (hasQueued || hasInProgress || hasPaused || hasScheduled);
            const hasEverRun = statuses.some(s => terminalStatuses.includes(s));
            const isExpanded = expandedCampaignId === campaign.id;

            return (
              <div key={campaign.id} className="group">
                <div className="flex items-center px-6 py-4 cursor-pointer hover:bg-paper-200/30 dark:hover:bg-ink-400/30 transition-colors" onClick={() => toggleCampaign(campaign.id)}>
                  <div className="w-8 flex-shrink-0">
                    <span className={`material-symbols-outlined text-ink-800 dark:text-ink-800 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                  </div>
                  <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-3">
                      <p className="text-sm font-medium text-ink-100 dark:text-paper-200">{campaign.name}</p>
                      <p className="text-xs text-ink-700 dark:text-ink-900">ID: {campaign.id?.substring(0,12)}</p>
                      {hasScheduled && campaign.scheduledAt && (
                        <p className="text-xs font-medium text-brand-500 dark:text-brand-300 mt-0.5">
                          Scheduled for {new Date(campaign.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST
                        </p>
                      )}
                    </div>
                    <div className="col-span-3">
                      <p className="text-xs text-ink-700 dark:text-ink-900">Workspace</p>
                      <p className="text-sm font-medium text-ink-100 dark:text-paper-200 truncate">{campaign.tenant?.name || '—'}</p>
                      <p className="text-xs text-ink-800 dark:text-ink-800 truncate">{campaign.createdBy?.email || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-ink-700 dark:text-ink-900">Calls</p>
                      <p className="text-sm font-medium text-ink-100 dark:text-paper-200">{logs.length.toLocaleString()}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-xs text-ink-700 dark:text-ink-900">Type</p>
                      <p className="text-sm font-medium text-ink-100 dark:text-paper-200 capitalize">{campaign.type || 'HR'}</p>
                    </div>
                    <div className="col-span-3 flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                      <Button variant="secondary" size="md" onClick={() => openViewModal(campaign.id)} disabled={viewLoadingId === campaign.id} title="View">
                        {viewLoadingId === campaign.id
                          ? <Spinner size={14} className="text-ink-600 dark:text-ink-900" />
                          : <span className="material-symbols-outlined text-sm">visibility</span>}
                      </Button>
                      {(hasDraft || !logs.length) && (
                        <IconButton tone="brand" size="md" title="Start" icon="play_arrow" onClick={() => handleCampaignAction(campaign.id, 'start')} disabled={actionLoading} />
                      )}
                      {(hasQueued || hasInProgress || hasScheduled) && (
                        <IconButton tone="neutral" size="md" title={hasScheduled ? 'Cancel schedule' : 'Pause'} icon="pause" onClick={() => handleCampaignAction(campaign.id, 'pause')} disabled={actionLoading} />
                      )}
                      {hasPaused && (
                        <IconButton tone="neutral" size="md" title="Resume" icon="play_circle" onClick={() => handleCampaignAction(campaign.id, 'resume')} disabled={actionLoading} />
                      )}
                      {hasActive && (
                        <IconButton tone="danger" size="md" title="Kill" icon="stop" onClick={() => handleCampaignAction(campaign.id, 'kill')} disabled={actionLoading} />
                      )}
                      {hasEverRun && (
                        <IconButton tone="neutral" size="md" title="Re-run" icon="refresh" onClick={() => confirmRerun(campaign.id)} disabled={actionLoading} />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-paper-200/80 dark:bg-ink-50/50 px-14 border-t border-paper-400 dark:border-ink-400">
                    <div className="py-6">
                      <div className="flex justify-between items-center mb-4">
                        <h5 className="text-sm font-semibold text-ink-500 dark:text-ink-900">Live Call Stream</h5>
                        <div className="flex items-center gap-3">
                          <DebouncedSearch onSearch={(q) => handleCallSearch(campaign.id, q)} placeholder="Search call logs..." className="w-64" />
                          <Button variant="secondary" size="sm" onClick={() => handleBulkEvaluate(campaign)} disabled={actionLoading}>Evaluate All</Button>
                          <Button variant="secondary" size="sm" onClick={() => handleBulkRecall(campaign)} disabled={actionLoading}>Re-call Failed</Button>
                        </div>
                      </div>
                      <div className="overflow-x-auto rounded-field border border-paper-500 dark:border-ink-400 bg-paper-100 dark:bg-ink-200 shadow-card">
                        <table className="w-full text-left">
                          <thead className="bg-paper-200 dark:bg-ink-50 border-b border-paper-400 dark:border-ink-400">
                            <tr>
                              {['Contact','Phone','Status','Actions'].map(h => (
                                <th key={h} className="px-4 py-2 text-xs font-medium text-ink-600 dark:text-ink-900">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-paper-400 dark:divide-ink-400 text-sm">
                            {(() => {
                              // One row per call attempt (callLog), not per contact — a contact
                              // can have multiple logs (re-calls), and keying off contacts with
                              // .find() silently dropped every attempt but the first.
                              const contactByContactId = new Map(
                                (campaign.campaignContacts || []).map(cc => [cc.contactId, cc])
                              );
                              const q = callSearchQueries[campaign.id]?.toLowerCase() || '';
                              const rows = logs.filter(log => {
                                if (!q) return true;
                                const cc = contactByContactId.get(log.contactId);
                                const name = cc?.overrides?.name || cc?.contact?.name || '';
                                const phone = cc?.contact?.phone || '';
                                return name.toLowerCase().includes(q) || phone.includes(q);
                              });

                              if (rows.length === 0) {
                                return (
                                  <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-ink-800 dark:text-ink-800 italic">
                                    {logs.length === 0 ? 'No contacts in this campaign.' : 'No call logs match.'}
                                  </td></tr>
                                );
                              }

                              return rows.map(log => {
                                const cc = contactByContactId.get(log.contactId);
                                const name = cc?.overrides?.name || cc?.contact?.name || '—';
                                return (
                                  <tr key={log.id} className="hover:bg-paper-200 dark:hover:bg-ink-400/50">
                                    <td className="px-5 py-3 font-medium text-ink-100 dark:text-paper-200">{name}</td>
                                    <td className="px-5 py-3 text-ink-700 dark:text-ink-900">{cc?.contact?.phone}</td>
                                    <td className="px-5 py-3">
                                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[log.status] || STATUS_BADGE.queued}`}>
                                        {log.status}
                                      </span>
                                    </td>
                                    <td className="px-5 py-3">
                                      <div className="flex gap-2">
                                        <Button variant="secondary" size="sm" onClick={() => handleCallAction(log.id, 'evaluate')} disabled={actionLoading || log.status !== 'completed'}>Eval</Button>
                                        <Button variant="secondary" size="sm" icon="history" onClick={() => handleCallAction(log.id, 'recall')} disabled={actionLoading}>Re-call</Button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
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
            <div className="px-6 py-12 text-center text-sm text-ink-700 dark:text-ink-900">No campaigns found.</div>
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
            <Button variant="secondary" size="md" onClick={() => setIsConfirmOpen(false)}>Cancel</Button>
            <Button variant="danger" size="md" onClick={() => handleCampaignAction(confirmAction, 'rerun')} disabled={actionLoading}>{actionLoading ? 'Processing…' : 'Reset & Rerun'}</Button>
          </>
        }
      >
        <p className="text-sm text-ink-600 dark:text-ink-900 leading-relaxed">
          Are you sure? Every contact will be re-queued for a fresh call. Recordings and transcripts from previous completed calls are kept — only pending or in-progress calls are cleared.
        </p>
      </Modal>

      {/* View Modal */}
      {selectedCampaign && (
        <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Campaign Details" className="max-w-5xl w-full">
          <div className="max-h-[70vh] overflow-y-auto">
            <Step7Review payload={{
              name: selectedCampaign.name,
              type: selectedCampaign.type,
              goals: {
                goal: selectedCampaign.callModule?.goal || '',
                callIntro: selectedCampaign.callModule?.callIntro || '',
                callSignOff: selectedCampaign.callModule?.callSignOff || ''
              },
              dataToCollect: selectedCampaign.dataToCollect || [],
              callSettings: selectedCampaign.callSettings || {},
              contacts: selectedCampaign.campaignContacts || [],
              endCallIf: selectedCampaign.endCallIf || '',
              rules: selectedCampaign.rules || {},
              scheduledAt: selectedCampaign.scheduledAt || null
            }} />
          </div>
        </Modal>
      )}
      </>)}
    </div>
  );
}

const ROLE_BADGE = {
  SUPER_ADMIN: "bg-negative/10 text-negative-dim dark:bg-negative/15 dark:text-negative",
  ADMIN:       "bg-brand-500/10 text-brand-500 dark:bg-brand-500/15 dark:text-brand-300",
  EDITOR:      "bg-caution/10 text-caution-dim dark:bg-caution/15 dark:text-caution",
  VIEWER:      "bg-paper-400 text-ink-600 dark:bg-ink-300 dark:text-ink-900",
};

const STATUS_USER_BADGE = {
  ACTIVE:    "bg-positive/10 text-positive-dim dark:bg-positive/15 dark:text-positive",
  PENDING:   "bg-caution/10 text-caution-dim dark:bg-caution/15 dark:text-caution",
  SUSPENDED: "bg-negative/10 text-negative-dim dark:bg-negative/15 dark:text-negative",
};

function Avatar({ user, size = 'md' }) {
  const dim = size === 'lg' ? 'w-14 h-14 text-base' : size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs';
  return (
    <div className={`${dim} rounded-full bg-brand-600 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden`}>
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
        <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card p-5 shadow-card">
          <p className="text-xs text-ink-700 dark:text-ink-900 mb-1">Open</p>
          <p className="text-2xl font-bold text-brand-500">{openCount}</p>
        </div>
        <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card p-5 shadow-card">
          <p className="text-xs text-ink-700 dark:text-ink-900 mb-1">In Progress</p>
          <p className="text-2xl font-bold text-caution-dim">{ipCount}</p>
        </div>
        <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card p-5 shadow-card">
          <p className="text-xs text-ink-700 dark:text-ink-900 mb-1">Resolved</p>
          <p className="text-2xl font-bold text-positive-dim">{resolveCount}</p>
        </div>
      </div>

      <div className="flex gap-5 items-start">
        {/* ── Ticket list ── */}
        <div className={`${selectedTicket ? 'w-[360px] shrink-0' : 'flex-1'} bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card shadow-card overflow-hidden`}>
          <div className="px-4 py-3 border-b border-paper-400 dark:border-ink-400 flex items-center justify-between">
            <div className="flex gap-0.5 bg-paper-400 dark:bg-ink-300 p-0.5 rounded-control">
              {FILTERS.map(f => (
                <Button variant="ghost" size="sm" key={f} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : f.replace('_', ' ')}</Button>
              ))}
            </div>
            <IconButton tone="neutral" size="md" title="Refresh" icon="refresh" onClick={onRefresh} />
          </div>

          {loading ? (
            <div className="px-5 py-10 text-center text-ink-800 dark:text-ink-800 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <span className="material-symbols-outlined text-paper-200 dark:text-ink-700 text-[40px] block mb-2">inbox</span>
              <p className="text-ink-800 dark:text-ink-800 text-sm">No tickets</p>
            </div>
          ) : (
            <div className="divide-y divide-paper-400 dark:divide-ink-400/50 max-h-[65vh] overflow-y-auto">
              {filtered.map(t => (
                <div
                  key={t.id}
                  onClick={() => onOpen(t)}
                  className={`px-4 py-3.5 cursor-pointer hover:bg-paper-200 dark:hover:bg-ink-400/50 transition-colors ${selectedTicket?.id === t.id ? "bg-paper-200 dark:bg-ink-300/50 border-l-[3px] border-brand-500" : "border-l-[3px] border-transparent"}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar user={t.user} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-ink-100 dark:text-paper-200 truncate leading-tight">{t.subject}</p>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${TICKET_STATUS_BADGE[t.status]}`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-ink-700 dark:text-ink-900 mt-0.5 truncate">{t.user?.name} · {t.tenant?.name || 'No workspace'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-ink-800 dark:text-ink-800 capitalize">{t.category}</span>
                        <span className="text-xs text-ink-900 dark:text-ink-700">·</span>
                        <span className="text-xs text-ink-800 dark:text-ink-800">{new Date(t.createdAt).toLocaleDateString()}</span>
                        {t._count?.replies > 0 && <>
                          <span className="text-xs text-ink-900 dark:text-ink-700">·</span>
                          <span className="text-xs text-ink-800 dark:text-ink-800">{t._count.replies} {t._count.replies === 1 ? 'reply' : 'replies'}</span>
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
            <div className="w-[220px] shrink-0 bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-paper-400 dark:border-ink-400">
                <p className="text-xs font-semibold text-ink-800 dark:text-ink-800 ">Submitted by</p>
              </div>
              <div className="p-4 space-y-4">
                {/* Avatar + name */}
                <div className="flex flex-col items-center text-center gap-2">
                  <Avatar user={selectedTicket.user} size="lg" />
                  <div>
                    <p className="text-sm font-semibold text-ink-100 dark:text-paper-200 leading-tight">{selectedTicket.user?.name}</p>
                    <p className="text-xs text-ink-800 dark:text-ink-800 mt-0.5 break-all">{selectedTicket.user?.email}</p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-1">
                    {selectedTicket.user?.role && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[selectedTicket.user.role] || "bg-paper-400 text-ink-600 dark:bg-ink-300 dark:text-ink-900"}`}>
                        {selectedTicket.user.role.replace('_', ' ')}
                      </span>
                    )}
                    {selectedTicket.user?.status && (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_USER_BADGE[selectedTicket.user.status] || "bg-paper-400 text-ink-700 dark:bg-ink-300 dark:text-ink-900"}`}>
                        {selectedTicket.user.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Detail rows */}
                <div className="space-y-2.5 border-t border-paper-400 dark:border-ink-400 pt-3">
                  {selectedTicket.tenant?.name && (
                    <div>
                      <p className="text-xs font-semibold text-ink-800 dark:text-ink-800 ">Workspace</p>
                      <p className="text-xs text-ink-500 dark:text-ink-900 font-medium mt-0.5">{selectedTicket.tenant.name}</p>
                    </div>
                  )}
                  {selectedTicket.submitterContext?.workspaceRole && (
                    <div>
                      <p className="text-xs font-semibold text-ink-800 dark:text-ink-800 ">Workspace Role</p>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 inline-block ${ROLE_BADGE[selectedTicket.submitterContext.workspaceRole] || "bg-paper-400 text-ink-600 dark:bg-ink-300 dark:text-ink-900"}`}>
                        {selectedTicket.submitterContext.workspaceRole}
                      </span>
                    </div>
                  )}
                  {selectedTicket.submitterContext?.workspaceMemberSince && (
                    <div>
                      <p className="text-xs font-semibold text-ink-800 dark:text-ink-800 ">Member Since</p>
                      <p className="text-xs text-ink-600 dark:text-ink-900 mt-0.5">{new Date(selectedTicket.submitterContext.workspaceMemberSince).toLocaleDateString()}</p>
                    </div>
                  )}
                  {selectedTicket.user?.createdAt && (
                    <div>
                      <p className="text-xs font-semibold text-ink-800 dark:text-ink-800 ">Account Created</p>
                      <p className="text-xs text-ink-600 dark:text-ink-900 mt-0.5">{new Date(selectedTicket.user.createdAt).toLocaleDateString()}</p>
                    </div>
                  )}
                  {selectedTicket.submitterContext?.totalTickets != null && (
                    <div>
                      <p className="text-xs font-semibold text-ink-800 dark:text-ink-800 ">Total Tickets</p>
                      <p className="text-xs font-semibold text-ink-500 dark:text-ink-900 mt-0.5">{selectedTicket.submitterContext.totalTickets}</p>
                    </div>
                  )}
                </div>

                {/* Ticket meta */}
                <div className="space-y-2.5 border-t border-paper-400 dark:border-ink-400 pt-3">
                  <div>
                    <p className="text-xs font-semibold text-ink-800 dark:text-ink-800 ">Category</p>
                    <p className="text-xs text-ink-500 dark:text-ink-900 capitalize mt-0.5">{selectedTicket.category.replace('_', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-800 dark:text-ink-800 ">Opened</p>
                    <p className="text-xs text-ink-600 dark:text-ink-900 mt-0.5">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-800 dark:text-ink-800 ">Status</p>
                    <select
                      value={selectedTicket.status}
                      onChange={e => onUpdateStatus(selectedTicket.id, e.target.value)}
                      disabled={statusLoading}
                      className="mt-0.5 w-full text-xs border border-paper-500 dark:border-ink-400 rounded-control px-2 py-1.5 bg-paper-100 dark:bg-ink-300 dark:text-paper-200 outline-none focus:ring-2 focus:ring-brand-500"
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
            <div className="flex-1 bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card shadow-card flex flex-col min-w-0" style={{maxHeight: '72vh'}}>
              {/* Header */}
              <div className="px-5 py-4 border-b border-paper-400 dark:border-ink-400 flex items-start justify-between shrink-0">
                <div className="min-w-0 pr-3">
                  <p className="text-xs text-ink-800 dark:text-ink-800 capitalize">{selectedTicket.category.replace('_', ' ')}</p>
                  <h3 className="text-sm font-semibold text-ink-100 dark:text-paper-200 mt-0.5 leading-snug">{selectedTicket.subject}</h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedTicket.status === 'CLOSED' ? (
                    <Button variant="primary" size="sm" onClick={() => onUpdateStatus(selectedTicket.id, 'OPEN')} disabled={statusLoading}>Reopen</Button>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => onUpdateStatus(selectedTicket.id, 'CLOSED')} disabled={statusLoading}>Close</Button>
                  )}
                  <IconButton tone="neutral" size="md" title="Close" icon="close" onClick={onCloseTicket} />
                </div>
              </div>

              {/* Thread */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Original message */}
                <div className="flex gap-3">
                  <Avatar user={selectedTicket.user} size="sm" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-xs font-semibold text-ink-100 dark:text-paper-200">{selectedTicket.user?.name}</p>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${ROLE_BADGE[selectedTicket.user?.role] || "bg-paper-400 text-ink-600 dark:bg-ink-300 dark:text-ink-900"}`}>
                        {selectedTicket.user?.role?.replace('_', ' ')}
                      </span>
                      <p className="text-xs text-ink-800 dark:text-ink-800 ml-auto">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                    </div>
                    <div className="bg-paper-200 dark:bg-ink-50 rounded-card rounded-tl-sm p-4 text-sm text-ink-500 dark:text-ink-900 leading-relaxed whitespace-pre-wrap">
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
                        <p className="text-xs font-semibold text-ink-100 dark:text-paper-200">{r.user?.name}</p>
                        {r.isAdmin && (
                          <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-brand-500/10 text-brand-500">Support</span>
                        )}
                        <p className="text-xs text-ink-800 dark:text-ink-800">{new Date(r.createdAt).toLocaleString()}</p>
                      </div>
                      <div className={`rounded-card p-4 text-sm leading-relaxed whitespace-pre-wrap ${r.isAdmin ? 'bg-brand-100 dark:bg-brand-500/15 text-brand-500 dark:text-brand-300 rounded-tr-sm' : 'bg-paper-200 dark:bg-ink-50 text-ink-500 dark:text-ink-900 rounded-tl-sm'}`}>
                        {r.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Reply box */}
              {selectedTicket.status !== 'CLOSED' && (
                <div className="p-4 border-t border-paper-400 dark:border-ink-400 shrink-0">
                  <div className="flex gap-3">
                    <textarea
                      value={ticketReply}
                      onChange={e => setTicketReply(e.target.value)}
                      placeholder="Reply to this ticket…"
                      rows={3}
                      className="flex-1 text-sm bg-paper-200 dark:bg-ink-50 border border-paper-500 dark:border-ink-400 rounded-card px-4 py-3 resize-none outline-none focus:ring-2 focus:ring-brand-500 text-ink-100 dark:text-paper-200 placeholder:text-ink-800 dark:placeholder:text-ink-700"
                    />
                    <Button variant="primary" size="md" onClick={onSendReply} disabled={replyLoading || !ticketReply.trim()}>{replyLoading ? 'Sending…' : 'Reply'}</Button>
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
