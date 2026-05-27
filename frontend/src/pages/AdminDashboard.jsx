import React, { useEffect, useState, useRef } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { Loader2 } from 'lucide-react';
import Modal from '../components/Modal';
import DebouncedSearch from '../components/DebouncedSearch';
import FullscreenWrapper from '../components/FullscreenWrapper';

const STATUS_BADGE = {
  completed:    'bg-emerald-50 text-emerald-700',
  failed:       'bg-[#ffdad6] text-[#ba1a1a]',
  cancelled:    'bg-orange-50 text-orange-700',
  'in-progress':'bg-blue-50 text-blue-700',
  queued:       'bg-zinc-100 text-zinc-600',
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
  const { addToast } = useToast();

  useEffect(() => {
    fetchCampaigns();
    const pollInterval = setInterval(fetchCampaigns, 3000);
    const clockInterval = setInterval(() => {
      setSecondsAgo(prev => prev + 1);
    }, 1000);
    return () => { clearInterval(pollInterval); clearInterval(clockInterval); };
  }, []);

  const fetchCampaigns = async () => {
    try {
      const res = await api.get('/api/campaigns');
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
            <span className="material-symbols-outlined text-[#3525cd] text-3xl">shield</span>
            <h2 className="text-3xl font-semibold text-[#1b1b24] tracking-tight">Admin Dashboard</h2>
          </div>
          <p className="text-[#464555] text-base">Real-time system oversight and campaign orchestration.</p>
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

      {/* Metrics Bento */}
      <div className="grid grid-cols-12 gap-6 mb-6">
        <div className="col-span-12 md:col-span-3 bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
          <p className="text-xs text-[#464555] mb-1 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Active Channels</p>
          <h3 className="text-2xl font-semibold text-[#1b1b24]">{totalChannels} / 2,000</h3>
          <div className="w-full bg-zinc-100 h-1.5 rounded-full mt-3">
            <div className="bg-[#3525cd] h-1.5 rounded-full" style={{width:`${Math.min(100, (totalChannels/2000)*100)}%`}}></div>
          </div>
        </div>
        <div className="col-span-12 md:col-span-3 bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
          <p className="text-xs text-[#464555] mb-1 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Calls per Second</p>
          <h3 className="text-2xl font-semibold text-[#1b1b24]">{totalCPS} CPS</h3>
          <p className="text-emerald-600 text-xs flex items-center gap-1 mt-2" style={{fontFamily:'JetBrains Mono, monospace'}}>
            <span className="material-symbols-outlined text-sm">trending_up</span> Live feed
          </p>
        </div>
        <div className="col-span-12 md:col-span-3 bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
          <p className="text-xs text-[#464555] mb-1 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>System Latency</p>
          <h3 className="text-2xl font-semibold text-[#1b1b24]">142ms</h3>
          <p className="text-zinc-500 text-xs flex items-center gap-1 mt-2" style={{fontFamily:'JetBrains Mono, monospace'}}>
            <span className="material-symbols-outlined text-sm">check_circle</span> Within SLA
          </p>
        </div>
        <div className="col-span-12 md:col-span-3 bg-white p-6 rounded-lg border border-zinc-200 shadow-sm">
          <p className="text-xs text-[#464555] mb-1 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Error Rate</p>
          <h3 className="text-2xl font-semibold text-[#1b1b24]">0.04%</h3>
          <p className="text-zinc-500 text-xs flex items-center gap-1 mt-2" style={{fontFamily:'JetBrains Mono, monospace'}}>
            <span className="material-symbols-outlined text-sm">info</span> Low impact
          </p>
        </div>
      </div>

      {/* Campaign Table */}
      <div className="bg-white rounded-lg border border-zinc-200 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h4 className="text-base font-semibold text-[#1b1b24]">Running Campaigns</h4>
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
          </div>
        </div>

        <div className="px-6 py-3 border-b border-zinc-100">
          <DebouncedSearch onSearch={setCampaignSearchQuery} placeholder="Search campaigns..." className="w-72" />
        </div>

        <div className="divide-y divide-zinc-100">
          {loading && (
            <div className="px-6 py-8 text-center">
              <Loader2 className="animate-spin mx-auto text-[#3525cd]" size={24} />
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
                  <div className="flex-1 grid grid-cols-6 gap-4 items-center">
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-zinc-900" style={{fontFamily:'JetBrains Mono, monospace'}}>{campaign.name}</p>
                      <p className="text-xs text-zinc-500" style={{fontFamily:'JetBrains Mono, monospace'}}>ID: {campaign.id?.substring(0,12)}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-xs text-zinc-500 uppercase" style={{fontFamily:'JetBrains Mono, monospace'}}>Call Count</p>
                      <p className="text-sm font-medium text-zinc-900" style={{fontFamily:'JetBrains Mono, monospace'}}>{logs.length.toLocaleString()}</p>
                    </div>
                    <div className="col-span-1">
                      <p className="text-xs text-zinc-500 uppercase" style={{fontFamily:'JetBrains Mono, monospace'}}>Type</p>
                      <p className="text-sm font-medium text-zinc-900 capitalize" style={{fontFamily:'JetBrains Mono, monospace'}}>{campaign.type || 'Outbound'}</p>
                    </div>
                    <div className="col-span-2 flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                      {(hasDraft || !logs.length) && (
                        <button onClick={() => handleCampaignAction(campaign.id, 'start')} disabled={actionLoading} className="bg-[#3525cd] text-white p-2 rounded-lg hover:bg-[#4f46e5] transition-colors shadow-sm disabled:opacity-50" title="Start">
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
            <div className="px-6 py-12 text-center text-sm text-[#777587]" style={{fontFamily:'JetBrains Mono, monospace'}}>No campaigns found.</div>
          )}
        </div>
      </div>

      {/* Security Console */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 bg-white p-6 rounded-lg border border-zinc-200 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-sm font-medium text-[#1b1b24]" style={{fontFamily:'JetBrains Mono, monospace'}}>Regional Traffic Density</h4>
            <span className="text-xs bg-zinc-100 px-2 py-1 rounded" style={{fontFamily:'JetBrains Mono, monospace'}}>Live Global Feed</span>
          </div>
          <div className="h-[240px] w-full bg-zinc-50 rounded-lg flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(#3525cd 1px, transparent 1px)', backgroundSize:'20px 20px'}}></div>
            <div className="relative z-10 text-center">
              <span className="material-symbols-outlined text-zinc-200 text-8xl mb-4">public</span>
              <p className="text-xs text-zinc-400" style={{fontFamily:'JetBrains Mono, monospace'}}>Map visualization active – Global Data Centers</p>
            </div>
            <div className="absolute top-1/4 left-1/3 w-3 h-3 bg-[#3525cd] rounded-full animate-ping"></div>
            <div className="absolute bottom-1/3 right-1/4 w-3 h-3 bg-[#3525cd] rounded-full animate-ping" style={{animationDelay:'1s'}}></div>
            <div className="absolute top-1/2 right-1/2 w-3 h-3 bg-[#3525cd] rounded-full animate-ping" style={{animationDelay:'0.5s'}}></div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-[#0f172a] p-6 rounded-lg shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <span className="material-symbols-outlined text-white text-9xl">terminal</span>
          </div>
          <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2" style={{fontFamily:'JetBrains Mono, monospace'}}>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Security Console
          </h4>
          <div className="text-xs text-zinc-400 space-y-3 overflow-hidden" style={{fontFamily:'JetBrains Mono, monospace'}}>
            <p className="text-emerald-400"># auth_service.v2: Connection secure</p>
            <p>&gt; Monitoring inbound API traffic...</p>
            <p className="text-zinc-500">14:23:12 [INFO] Handshake verified</p>
            <p className="text-zinc-500">14:23:14 [INFO] Node 4-Alpha scaling</p>
            <p className="text-amber-400">14:23:18 [WARN] Rate limit approaching (92%)</p>
            <p className="text-zinc-500">14:23:22 [INFO] Load balancer adjusted</p>
            <p className="border-t border-zinc-800 pt-2 text-white">READY FOR NEW TASK_</p>
          </div>
          <div className="mt-6">
            <button className="w-full py-2 bg-zinc-800 text-white rounded text-xs border border-zinc-700 hover:bg-zinc-700 transition-colors" style={{fontFamily:'JetBrains Mono, monospace'}}>
              Re-authenticate All Nodes
            </button>
          </div>
        </div>
      </div>

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
    </div>
  );
}
