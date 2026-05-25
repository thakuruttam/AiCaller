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
    // Poll every 6 seconds for real-time status updates
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
    // Determine which calls are considered failed/needs follow up
    // In our system, status doesn't always reflect final outcome directly if evaluating,
    // but typically we can check for failed status or let the backend handle it.
    // Assuming backend endpoint /recall takes care of finding the contact.
    // For bulk, let's target logs that are 'failed' or 'cancelled'
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
    return <div className="p-8 text-muted-foreground">Loading admin dashboard...</div>;
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
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="text-primary" size={28} /> Admin Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">Centralized control for all campaign executions, calls, and evaluation pipelines.</p>
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
            <div key={campaign.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
              {/* Campaign Header Row */}
              <div 
                className="flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 cursor-pointer border-b border-transparent transition-colors"
                onClick={() => toggleCampaign(campaign.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown size={20} className="text-muted-foreground" /> : <ChevronRight size={20} className="text-muted-foreground" />}
                  <div>
                    <h3 className="font-semibold text-lg">{campaign.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="font-mono bg-muted px-1.5 rounded">{campaign.id.split('-')[0]}</span>
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
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Play size={14} /> Start
                    </button>
                  )}
                  {(hasQueued || hasInProgress) && (
                    <button 
                      onClick={() => handleCampaignAction(campaign.id, 'pause')}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      <Pause size={14} /> Pause
                    </button>
                  )}
                  {hasPaused && (
                    <button 
                      onClick={() => handleCampaignAction(campaign.id, 'resume')}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      <Play size={14} /> Resume
                    </button>
                  )}
                  {hasActive && (
                    <button
                      onClick={() => handleCampaignAction(campaign.id, 'kill')}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 disabled:opacity-50"
                    >
                      <XOctagon size={14} /> Kill All
                    </button>
                  )}
                  {hasEverRun && (
                    <button
                      onClick={() => confirmRerun(campaign.id)}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent disabled:opacity-50 ml-2"
                    >
                      <RefreshCw size={14} /> Re-run
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="p-0 border-t border-border bg-background">
                  <FullscreenWrapper
                    className="max-h-[400px]"
                    title={
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Activity size={16} className="text-primary"/> Call Management
                      </span>
                    }
                    actionNode={
                      <div className="flex items-center gap-4">
                        <DebouncedSearch 
                          onSearch={(q) => handleCallSearch(campaign.id, q)} 
                          placeholder="Search calls by name or phone..." 
                          className="w-64"
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleBulkEvaluate(campaign)}
                            disabled={actionLoading}
                            className="text-xs font-medium px-3 py-1.5 rounded-md border border-input hover:bg-accent transition-colors disabled:opacity-50"
                          >
                            Evaluate All Completed
                          </button>
                          <button 
                            onClick={() => handleBulkRecall(campaign)}
                            disabled={actionLoading}
                            className="text-xs font-medium px-3 py-1.5 rounded-md border border-input hover:bg-accent transition-colors disabled:opacity-50"
                          >
                            Re-call All Failed
                          </button>
                        </div>
                      </div>
                    }
                  >
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted/30 border-b text-muted-foreground text-xs uppercase">
                        <tr>
                          <th className="h-10 px-6 font-medium">Contact</th>
                          <th className="h-10 px-6 font-medium">Phone</th>
                          <th className="h-10 px-6 font-medium">Status</th>
                          <th className="h-10 px-6 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
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
                            <tr key={cc.id} className="hover:bg-muted/10 transition-colors">
                              <td className="px-6 py-3 font-medium">{name}</td>
                              <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{cc.contact.phone}</td>
                              <td className="px-6 py-3">
                                {log ? (
                                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    log.status === 'completed' ? 'bg-green-100 text-green-800' :
                                    log.status === 'failed' || log.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                    'bg-secondary text-secondary-foreground'
                                  }`}>
                                    {log.status}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic">No log</span>
                                )}
                              </td>
                              <td className="px-6 py-3 text-right">
                                {log && (
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      onClick={() => handleCallAction(log.id, 'evaluate')}
                                      disabled={actionLoading || log.status !== 'completed'}
                                      className="text-[11px] font-medium px-2.5 py-1 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50"
                                      title="Run AI Evaluation"
                                    >
                                      Eval
                                    </button>
                                    <button
                                      onClick={() => handleCallAction(log.id, 'recall')}
                                      disabled={actionLoading}
                                      className="text-[11px] font-medium px-2.5 py-1 rounded border border-input hover:bg-accent transition-colors disabled:opacity-50"
                                      title="Queue Outbound Re-call"
                                    >
                                      <Phone size={12} className="inline mr-1" /> Re-call
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {(!campaign.campaignContacts || campaign.campaignContacts.length === 0) && (
                          <tr>
                            <td colSpan="4" className="px-6 py-4 text-center text-muted-foreground text-xs italic">
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
          <div className="text-center p-12 border border-dashed rounded-xl text-muted-foreground">
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
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 border border-input bg-background hover:bg-accent"
            >
              Cancel
            </button>
            <button 
              onClick={() => handleCampaignAction(confirmAction, 'rerun')}
              disabled={actionLoading}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? 'Processing...' : 'Reset & Rerun'}
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Are you sure? This will <strong>PERMANENTLY delete</strong> all previous transcripts and recordings for this campaign to start fresh.
        </p>
      </Modal>
    </div>
  );
}
