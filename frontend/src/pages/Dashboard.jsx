import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Link, useNavigate } from 'react-router-dom';
import Spinner from '../components/Spinner';
import FullscreenTable, { FullscreenButton } from '../components/FullscreenTable';
import RoleGate from '../components/RoleGate';
import DebouncedSearch from '../components/DebouncedSearch';
import Modal from '../components/Modal';
import Step7Review from './CampaignWizard/components/Step7Review';
import { useAuth } from '../context/AuthContext';

const STATUS_BADGE = {
  active:      'bg-emerald-50 text-emerald-700',
  completed:   'bg-emerald-50 text-emerald-700',
  queued:      'bg-zinc-100 text-zinc-600',
  paused:      'bg-zinc-100 text-zinc-600',
  'in-progress':'bg-blue-50 text-blue-700',
  failed:      'bg-[#ffdad6] text-[#ba1a1a]',
  cancelled:   'bg-orange-50 text-orange-700',
};

function StatusBadge({ status }) {
  const cls = STATUS_BADGE[status] || STATUS_BADGE.queued;
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize ${cls}`} style={{fontFamily:'JetBrains Mono, monospace'}}>
      {status}
    </span>
  );
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'no-answer', 'busy', 'cancelled']);

function CampaignCostInsight({ campaign }) {
  const logs = campaign.callLogs || [];
  const totalContacts = campaign.campaignContacts?.length || 0;

  const latestByContact = {};
  logs.forEach(l => {
    const prev = latestByContact[l.contactId];
    if (!prev || new Date(l.createdAt) > new Date(prev.createdAt)) latestByContact[l.contactId] = l;
  });
  const latestLogs = Object.values(latestByContact);
  const contactsDone = latestLogs.filter(l => TERMINAL_STATUSES.has(l.status)).length;
  const contactsRemaining = Math.max(0, totalContacts - contactsDone);
  const costIncurred = logs.reduce((s, l) => s + (l.billableMinutes || 0), 0) * 5;
  const maxDurationMin = campaign.maxCallDurationSec
    ? Math.ceil(campaign.maxCallDurationSec / 60)
    : (campaign.callSettings?.maxDuration || 5);
  const estCostPerCall = maxDurationMin * 5;
  const totalEstCost = totalContacts * estCostPerCall;
  const remainingEstCost = contactsRemaining * estCostPerCall;
  const pct = totalContacts > 0 ? Math.round((contactsDone / totalContacts) * 100) : 0;

  return (
    <div className="flex flex-col gap-2 min-w-[170px]">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : '#0d9488' }}
          />
        </div>
        <span className="text-[11px] text-zinc-400 font-mono shrink-0">{contactsDone}/{totalContacts}</span>
      </div>
      {/* Metric grid */}
      <div className="grid grid-cols-3 gap-x-3">
        {/* Spent — actual, real billable minutes */}
        <div>
          <p className="text-[10px] text-zinc-400 uppercase tracking-wide leading-none mb-0.5">Spent</p>
          <p className="text-[13px] font-bold text-[#0d9488] leading-none">₹{costIncurred}</p>
        </div>
        {/* Left — estimated remaining */}
        <div>
          <div className="flex items-center gap-0.5 mb-0.5">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wide leading-none">Left</p>
            <span className="text-[9px] text-amber-400 font-semibold leading-none">~est</span>
          </div>
          <p className="text-[13px] font-bold text-amber-500 leading-none">~₹{remainingEstCost}</p>
        </div>
        {/* Total — estimated based on max duration */}
        <div>
          <div className="flex items-center gap-0.5 mb-0.5">
            <p className="text-[10px] text-zinc-400 uppercase tracking-wide leading-none">Total</p>
            <span className="text-[9px] text-zinc-400 font-semibold leading-none">~est</span>
          </div>
          <p className="text-[13px] font-semibold text-[#334155] leading-none">~₹{totalEstCost}</p>
        </div>
      </div>
    </div>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [loadingCampaignId, setLoadingCampaignId] = useState(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchCampaigns(true);
    const interval = setInterval(() => fetchCampaigns(false), 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchCampaigns = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await api.get(isSuperAdmin ? '/api/campaigns?all=true' : '/api/campaigns');
      setCampaigns(res.data);
    } catch (e) {
      console.error('Error fetching campaigns', e);
    } finally {
      setLoading(false);
    }
  };

  const openViewModal = async (campaignId) => {
    try {
      setLoadingCampaignId(campaignId);
      const res = await api.get(`/api/campaigns/${campaignId}`);
      setSelectedCampaign(res.data);
      setIsViewModalOpen(true);
    } catch (err) {
      console.error('Error fetching campaign details:', err);
    } finally {
      setLoadingCampaignId(null);
    }
  };

  const getStats = () => {
    let total = 0, completed = 0;
    campaigns.forEach(c => {
      if (c.callLogs) {
        total     += c.callLogs.length;
        completed += c.callLogs.filter(l => l.status === 'completed').length;
      }
    });
    return { total, completed };
  };

  const stats = getStats();
  const successRate = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : '0.0';

  const filteredCampaigns = campaigns.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const PER_PAGE = 4;

  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-[#0f172a] tracking-tight">Dashboard</h1>
          <p className="text-base text-[#334155] mt-1">Real-time oversight of enterprise voice operations.</p>
        </div>
        <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']}>
          <Link
            to="/create-campaign"
            className="flex items-center gap-2 bg-[#0d9488] hover:bg-[#0f766e] text-white px-6 py-3 rounded text-sm transition-all shadow-md active:scale-95"
            style={{fontFamily:'JetBrains Mono, monospace'}}
          >
            <span className="material-symbols-outlined text-[18px]">campaign</span>
            New Campaign
          </Link>
        </RoleGate>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Total Calls Queued */}
        <div className="bg-white border border-zinc-200 p-6 rounded shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-[#e2dfff] flex items-center justify-center">
              <span className="material-symbols-outlined text-[#0d9488]">queue</span>
            </div>
            <span className="text-xs text-[#0d9488] bg-[#e2dfff] px-2 py-1 rounded" style={{fontFamily:'JetBrains Mono, monospace'}}>+12.5%</span>
          </div>
          <p className="text-xs text-[#334155] mb-1 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Total Calls Queued</p>
          <h3 className="text-5xl font-bold text-[#0f172a]" style={{letterSpacing:'-0.02em'}}>{loading ? '—' : stats.total.toLocaleString()}</h3>
        </div>

        {/* Completed Calls */}
        <div className="bg-white border border-zinc-200 p-6 rounded shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600">check_circle</span>
            </div>
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded" style={{fontFamily:'JetBrains Mono, monospace'}}>On Track</span>
          </div>
          <p className="text-xs text-[#334155] mb-1 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Completed Calls</p>
          <h3 className="text-5xl font-bold text-[#0f172a]" style={{letterSpacing:'-0.02em'}}>{loading ? '—' : stats.completed.toLocaleString()}</h3>
        </div>

        {/* Success Rate */}
        <div className="bg-white border border-zinc-200 p-6 rounded shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-600">trending_up</span>
            </div>
            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded" style={{fontFamily:'JetBrains Mono, monospace'}}>Target 92%</span>
          </div>
          <p className="text-xs text-[#334155] mb-1 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Success Rate %</p>
          <h3 className="text-5xl font-bold text-[#0f172a]" style={{letterSpacing:'-0.02em'}}>{loading ? '—' : `${successRate}%`}</h3>
        </div>
      </div>

      {/* Active Campaigns Table */}
      <FullscreenTable className="bg-white border border-zinc-200 rounded shadow-sm overflow-hidden">
        {({ toggle, isFs }) => {
          const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / PER_PAGE));
          const paginated = isFs ? filteredCampaigns : filteredCampaigns.slice((page - 1) * PER_PAGE, page * PER_PAGE);
          return (<>
        <div className="p-6 border-b border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <h4 className="text-xl font-semibold text-[#0f172a]">Active Campaigns</h4>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] text-[18px]">filter_list</span>
              <input
                className="w-full bg-[#e6fffa] border-none rounded py-2 pl-10 pr-4 text-sm text-[#0f172a] focus:outline-none focus:ring-1 focus:ring-[#0d9488] placeholder:text-[#64748b]"
                placeholder="Filter campaigns..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>
            <button className="p-2 border border-[#cbd5e1] rounded hover:bg-[#e6fffa] transition-colors">
              <span className="material-symbols-outlined text-[#334155]">download</span>
            </button>
            <FullscreenButton toggle={toggle} isFs={isFs} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="px-6 py-4 text-xs text-[#334155] uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Campaign Name</th>
                {isSuperAdmin && <th className="px-6 py-4 text-xs text-[#334155] uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Workspace</th>}
                <th className="px-6 py-4 text-xs text-[#334155] uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Status</th>
                <th className="px-6 py-4 text-xs text-[#334155] uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Contacts</th>
                <th className="px-6 py-4 text-xs text-[#334155] uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Cost Insight</th>
                <th className="px-6 py-4 text-xs text-[#334155] uppercase tracking-wider text-right" style={{fontFamily:'JetBrains Mono, monospace'}}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-4"><div className="h-4 bg-zinc-100 rounded w-40 mb-1" /><div className="h-3 bg-zinc-100 rounded w-24" /></td>
                  {isSuperAdmin && <td className="px-6 py-4"><div className="h-4 bg-zinc-100 rounded w-28" /></td>}
                  <td className="px-6 py-4"><div className="h-5 bg-zinc-100 rounded-full w-20" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-zinc-100 rounded w-16" /></td>
                  <td className="px-6 py-4"><div className="h-4 bg-zinc-100 rounded w-12" /></td>
                  <td className="px-6 py-4 text-right"><div className="h-8 bg-zinc-100 rounded w-20 ml-auto" /></td>
                </tr>
              ))}
              {!loading && paginated.map(c => (
                <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-base font-semibold text-[#0f172a]">{c.name}</span>
                      <span className="text-xs text-[#64748b]" style={{fontFamily:'JetBrains Mono, monospace'}}>
                        Created {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '—'}
                      </span>
                    </div>
                  </td>
                  {isSuperAdmin && (
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e6fffa] border border-[#e2e8f0] text-xs font-semibold text-[#0d9488]" style={{fontFamily:'JetBrains Mono, monospace'}}>
                        <span className="material-symbols-outlined text-[12px]" style={{fontVariationSettings:"'FILL' 1"}}>corporate_fare</span>
                        {c.tenant?.name || '—'}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <StatusBadge status={c.status || 'queued'} />
                  </td>
                  <td className="px-6 py-4 text-sm text-[#0f172a]" style={{fontFamily:'JetBrains Mono, monospace'}}>
                    {c.campaignContacts?.length || 0}
                  </td>
                  <td className="px-6 py-4">
                    <CampaignCostInsight campaign={c} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openViewModal(c.id)}
                        disabled={loadingCampaignId === c.id}
                        className="p-2 hover:bg-[#e2dfff]/50 text-[#0d9488] transition-colors rounded"
                        title="View"
                      >
                        {loadingCampaignId === c.id
                          ? <Spinner size={18} className="text-[#0d9488]" />
                          : <span className="material-symbols-outlined text-[20px]">visibility</span>}
                      </button>
                      <Link to={`/edit-campaign/${c.id}`} className="p-2 hover:bg-[#e6fffa] text-[#334155] transition-colors rounded" title="Edit">
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </Link>
                      <Link to={`/campaigns/${c.id}/report`} className="p-2 hover:bg-[#e6fffa] text-[#334155] transition-colors rounded" title="Report">
                        <span className="material-symbols-outlined text-[20px]">assessment</span>
                      </Link>
                      <Link to={`/campaigns/${c.id}`} className="p-2 hover:bg-[#e6fffa] text-[#334155] transition-colors rounded" title="Details">
                        <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredCampaigns.length === 0 && (
                <tr>
                  <td colSpan={isSuperAdmin ? 6 : 5} className="px-6 py-12 text-center text-sm text-[#64748b]">No campaigns found.</td>
                </tr>
              )}

            </tbody>
          </table>
        </div>

        <div className="px-6 py-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between">
          <span className="text-xs text-[#334155]" style={{fontFamily:'JetBrains Mono, monospace'}}>
            {isFs
              ? `${filteredCampaigns.length} campaign${filteredCampaigns.length !== 1 ? 's' : ''}`
              : `Showing ${Math.min((page - 1) * PER_PAGE + 1, filteredCampaigns.length)}–${Math.min(page * PER_PAGE, filteredCampaigns.length)} of ${filteredCampaigns.length} campaign${filteredCampaigns.length !== 1 ? 's' : ''}`
            }
          </span>
          {!isFs && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs border border-zinc-200 rounded hover:bg-zinc-100 disabled:opacity-30 transition-colors"
                style={{fontFamily:'JetBrains Mono, monospace'}}
              >Previous</button>
              <span className="text-xs text-[#334155]" style={{fontFamily:'JetBrains Mono, monospace'}}>{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="px-3 py-1 text-xs border border-zinc-200 rounded hover:bg-zinc-100 disabled:opacity-30 transition-colors"
                style={{fontFamily:'JetBrains Mono, monospace'}}
              >Next</button>
            </div>
          )}
        </div>
        </>);
        }}
      </FullscreenTable>

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
              rules: selectedCampaign.rules || {}
            }} />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Dashboard;
