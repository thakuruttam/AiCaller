import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import {
  ShieldAlert, Play, Pause, RefreshCw, XOctagon,
  ChevronDown, ChevronRight, Activity, Phone
} from 'lucide-react';
import Modal from '../components/Modal';
import DebouncedSearch from '../components/DebouncedSearch';
import FullscreenWrapper from '../components/FullscreenWrapper';

const STATUS_BADGE = {
  completed:    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-700',
  failed:       'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-700',
  cancelled:    'bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-700',
  'in-progress':'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-700',
  queued:       'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-slate-700 dark:text-slate-400 dark:ring-slate-600',
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
  const { addToast } = useToast();

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 6000);
    return () => clearInterval(interval);
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/campaigns');
      setCampaigns(res.data);
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
      console.error(e);
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
      console.error(e);
      addToast(`Failed to ${actionStr} call`, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkEvaluate = async (campaign) => {
    const callsToEvaluate = (campaign.callLogs || []).filter(l => l.status === 'completed');
    if (callsToEvaluate.length === 0) {
      addToast("No completed calls to evaluate", "info");
      return;
    }
    setActionLoading(true);
    let successCount = 0;
    for (const call of callsToEvaluate) {
      try {
        await api.post(`/api/campaigns/calls/${call.id}/evaluate`);
        successCount++;
      } catch (e) {
        console.error(`Failed to evaluate call ${call.id}`, e);
      }
    }
    setActionLoading(false);
    addToast(`Queued ${successCount} of ${callsToEvaluate.length} evaluations`, "success");
  };

  const handleBulkRecall = async (campaign) => {
    const callsToRecall = (campaign.callLogs || []).filter(l => ['failed', 'cancelled'].includes(l.status));
    if (callsToRecall.length === 0) {
      addToast("No failed calls to re-call", "info");
      return;
    }
    setActionLoading(true);
    let successCount = 0;
    for (const call of callsToRecall) {
      try {
        await api.post(`/api/campaigns/calls/${call.id}/recall`);
        successCount++;
      } catch (e) {
        console.error(`Failed to re-call ${call.id}`, e);
      }
    }
    setActionLoading(false);
    addToast(`Queued ${successCount} of ${callsToRecall.length} re-calls`, "success");
    await fetchCampaigns();
  };

  const confirmRerun = (campaignId) => {
    setConfirmAction(campaignId);
    setIsConfirmOpen(true);
  };

  if (loading && campaigns.length === 0) {
    return <div className="p-8 text-zinc-500 dark:text-slate-400">Loading admin dashboard...</div>;
  }

  const toggleCampaign = (id) => {
    setExpandedCampaignId(prev => prev === id ? null : id);
  };

  const handleCallSearch = (campaignId, query) => {
    setCallSearchQueries(prev => ({ ...prev, [campaignId]: query }));
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-slate-100 tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="text-indigo-600" size={22} /> Admin Dashboard
          </h2>
          <p className="text-zinc-500 dark:text-slate-400 text-sm mt-1">Centralized control for all campaign executions, calls, and evaluation pipelines.</p>
        </div>
        <DebouncedSearch
          onSearch={setCampaignSearchQuery}
          placeholder="Search campaigns..."
          className="w-72"
        />
      </div>

      <div className="flex flex-col gap-4">
        {campaigns
          .filter(c => c.name?.toLowerCase().includes(campaignSearchQuery.toLowerCase()))
          .map(campaign => {
            const logs = campaign.callLogs || [];
            const statuses = logs.map(l => l.status);

            const hasDraft = statuses.includes('draft');
            const hasQueued = statuses.includes('queued');
            const hasInProgress = statuses.includes('in-progress');
            const hasPaused = statuses.includes('paused');
            const hasActive = hasQueued || hasInProgress || hasPaused;
            const hasEverRun = statuses.some(s => ['completed', 'failed', 'cancelled'].includes(s));

            const isExpanded = expandedCampaignId === campaign.id;

            return (
              <div key={campaign.id} className="rounded-2xl border border-zinc-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.05] overflow-hidden">
                {/* Campaign Header Row */}
                <div
                  className="flex items-center justify-between p-4 bg-zinc-50/80 dark:bg-slate-800/60 hover:bg-zinc-50 dark:hover:bg-slate-700/50 cursor-pointer border-b border-zinc-100 dark:border-slate-700/50 transition-colors"
                  onClick={() => toggleCampaign(campaign.id)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded
                      ? <ChevronDown size={18} className="text-zinc-400 dark:text-slate-500" />
                      : <ChevronRight size={18} className="text-zinc-400 dark:text-slate-500" />}
                    <div>
                      <h3 className="font-semibold text-base text-zinc-900 dark:text-slate-100">{campaign.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-slate-400 mt-0.5">
                        <span className="font-mono bg-zinc-200 dark:bg-slate-700 px-1.5 rounded text-zinc-600 dark:text-slate-400">{campaign.id.split('-')[0]}</span>
                        <span>{logs.length} Total Calls</span>
                        <span>•</span>
                        <span className="capitalize">{campaign.type}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {hasDraft && (
                      <button
                        onClick={() => handleCampaignAction(campaign.id, 'start')}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        <Play size={13} /> Start
                      </button>
                    )}
                    {(hasQueued || hasInProgress) && (
                      <button
                        onClick={() => handleCampaignAction(campaign.id, 'pause')}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-medium text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        <Pause size={13} /> Pause
                      </button>
                    )}
                    {hasPaused && (
                      <button
                        onClick={() => handleCampaignAction(campaign.id, 'resume')}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-medium text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        <Play size={13} /> Resume
                      </button>
                    )}
                    {hasActive && (
                      <button
                        onClick={() => handleCampaignAction(campaign.id, 'kill')}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        <XOctagon size={13} /> Kill All
                      </button>
                    )}
                    {hasEverRun && (
                      <button
                        onClick={() => confirmRerun(campaign.id)}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-xs font-medium text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50 disabled:opacity-50 transition-colors shadow-sm ml-2"
                      >
                        <RefreshCw size={13} /> Re-run
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <FullscreenWrapper
                      className="max-h-[400px] border-0 rounded-none shadow-none"
                      title={
                        <span className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-slate-300">
                          <Activity size={15} className="text-indigo-600" /> Call Management
                        </span>
                      }
                      actionNode={
                        <div className="flex items-center gap-3">
                          <DebouncedSearch
                            onSearch={(q) => handleCallSearch(campaign.id, q)}
                            placeholder="Search by name or phone..."
                            className="w-60"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleBulkEvaluate(campaign)}
                              disabled={actionLoading}
                              className="text-xs font-medium px-3 py-1.5 rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-zinc-50 dark:hover:bg-slate-700/50 text-zinc-700 dark:text-slate-300 transition-colors disabled:opacity-50 shadow-sm"
                            >
                              Evaluate All Completed
                            </button>
                            <button
                              onClick={() => handleBulkRecall(campaign)}
                              disabled={actionLoading}
                              className="text-xs font-medium px-3 py-1.5 rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-zinc-50 dark:hover:bg-slate-700/50 text-zinc-700 dark:text-slate-300 transition-colors disabled:opacity-50 shadow-sm"
                            >
                              Re-call All Failed
                            </button>
                          </div>
                        </div>
                      }
                    >
                      <table className="w-full text-sm text-left">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-900">
                            {['Contact', 'Phone', 'Status', ''].map(h => (
                              <th key={h} className={`px-5 py-3 text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider ${h === '' ? 'text-right' : 'text-left'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-slate-700">
                          {(campaign.campaignContacts || [])
                            .filter(cc => {
                              const query = callSearchQueries[campaign.id]?.toLowerCase() || '';
                              if (!query) return true;
                              const nameMatch = (cc.overrides?.name || cc.contact.name || '').toLowerCase().includes(query);
                              const phoneMatch = (cc.contact.phone || '').toLowerCase().includes(query);
                              return nameMatch || phoneMatch;
                            })
                            .map(cc => {
                              const log = logs.find(l => l.contactId === cc.contact.id);
                              const name = cc.overrides?.name || cc.contact.name;
                              return (
                                <tr key={cc.id} className="hover:bg-zinc-50/70 dark:hover:bg-slate-700/50 transition-colors">
                                  <td className="px-5 py-3.5 font-semibold text-zinc-900 dark:text-slate-100">{name}</td>
                                  <td className="px-5 py-3.5 font-mono text-xs text-zinc-500 dark:text-slate-400">{cc.contact.phone}</td>
                                  <td className="px-5 py-3.5">
                                    {log ? (
                                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[log.status] || STATUS_BADGE.queued}`}>
                                        {log.status}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-zinc-400 dark:text-slate-500 italic">No log</span>
                                    )}
                                  </td>
                                  <td className="px-5 py-3.5 text-right">
                                    {log && (
                                      <div className="flex items-center justify-end gap-2">
                                        <button
                                          onClick={() => handleCallAction(log.id, 'evaluate')}
                                          disabled={actionLoading || log.status !== 'completed'}
                                          className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-zinc-50 dark:hover:bg-slate-700/50 text-zinc-700 dark:text-slate-300 transition-colors disabled:opacity-50 shadow-sm"
                                          title="Run AI Evaluation"
                                        >
                                          Eval
                                        </button>
                                        <button
                                          onClick={() => handleCallAction(log.id, 'recall')}
                                          disabled={actionLoading}
                                          className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-zinc-50 dark:hover:bg-slate-700/50 text-zinc-700 dark:text-slate-300 transition-colors disabled:opacity-50 shadow-sm"
                                          title="Queue Outbound Re-call"
                                        >
                                          <Phone size={11} className="inline mr-1" /> Re-call
                                        </button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          {(!campaign.campaignContacts || campaign.campaignContacts.length === 0) && (
                            <tr>
                              <td colSpan={4} className="px-5 py-8 text-center text-sm text-zinc-400 dark:text-slate-500 italic">
                                No contacts in this campaign.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </FullscreenWrapper>
                  </div>
                )}
              </div>
            );
          })}

        {campaigns.length > 0 && campaigns.filter(c => c.name?.toLowerCase().includes(campaignSearchQuery.toLowerCase())).length === 0 && (
          <div className="text-center p-12 border border-dashed border-zinc-200 dark:border-slate-700 rounded-xl text-zinc-500 dark:text-slate-400">
            No matching campaigns found.
          </div>
        )}
      </div>

      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Re-run Campaign?"
        footer={
          <>
            <button
              onClick={() => setIsConfirmOpen(false)}
              className="inline-flex items-center justify-center rounded-lg text-sm font-medium h-9 px-4 border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-zinc-50 dark:hover:bg-slate-700/50 active:bg-zinc-100 text-zinc-700 dark:text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleCampaignAction(confirmAction, 'rerun')}
              disabled={actionLoading}
              className="inline-flex items-center justify-center rounded-lg text-sm font-semibold h-9 px-4 bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? 'Processing…' : 'Reset & Rerun'}
            </button>
          </>
        }
      >
        <p className="text-sm text-zinc-600 dark:text-slate-400 leading-relaxed">
          Are you sure? This will <strong className="text-zinc-900 dark:text-slate-100">permanently delete</strong> all previous transcripts and recordings for this campaign and start fresh.
        </p>
      </Modal>
    </div>
  );
}
