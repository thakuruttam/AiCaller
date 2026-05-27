import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import RoleGate from '../components/RoleGate';
import DebouncedSearch from '../components/DebouncedSearch';
import Modal from '../components/Modal';
import Step7Review from './CampaignWizard/components/Step7Review';
import { EVAL_BASE } from '../api/config';

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

const Dashboard = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [evalProgress, setEvalProgress] = useState({ total: 0, completed: 0, failed: 0, inProgress: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [loadingCampaignId, setLoadingCampaignId] = useState(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 3;

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const resCampaigns = await api.get('/api/campaigns');
      const campaignsData = resCampaigns.data;
      const progressPromises = campaignsData.map(c =>
        axios.get(`${EVAL_BASE}/reports/campaign/${c.id}/progress`)
           .catch(() => ({ data: { total: 0, completed: 0, failed: 0, inProgress: 0 } }))
      );
      const progressResults = await Promise.all(progressPromises);
      const agg = progressResults.reduce((acc, curr) => {
        acc.total      += curr.data.total      || 0;
        acc.completed  += curr.data.completed  || 0;
        acc.failed     += curr.data.failed     || 0;
        acc.inProgress += curr.data.inProgress || 0;
        return acc;
      }, { total: 0, completed: 0, failed: 0, inProgress: 0 });
      setCampaigns(campaignsData);
      setEvalProgress(agg);
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
  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / PER_PAGE));
  const paginated = filteredCampaigns.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const pipelineItems = [
    { icon: 'record_voice_over', label: 'Sentiment Extraction Module', sub: `${evalProgress.inProgress} In Progress`, status: 'in-progress', statusLabel: 'In Progress' },
    { icon: 'translate', label: 'Multi-lingual Transcription', sub: `${evalProgress.completed} Completed`, status: 'completed', statusLabel: 'Completed' },
    { icon: 'security', label: 'PII Masking & Compliance', sub: `${evalProgress.failed} Failed`, status: evalProgress.failed > 0 ? 'failed' : 'completed', statusLabel: evalProgress.failed > 0 ? 'Failed' : 'Completed' },
  ];

  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-[#1b1b24] tracking-tight">Dashboard</h1>
          <p className="text-base text-[#464555] mt-1">Real-time oversight of enterprise voice operations.</p>
        </div>
        <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']}>
          <Link
            to="/create-campaign"
            className="flex items-center gap-2 bg-[#3525cd] hover:bg-[#4f46e5] text-white px-6 py-3 rounded text-sm transition-all shadow-md active:scale-95"
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
              <span className="material-symbols-outlined text-[#3525cd]">queue</span>
            </div>
            <span className="text-xs text-[#3525cd] bg-[#e2dfff] px-2 py-1 rounded" style={{fontFamily:'JetBrains Mono, monospace'}}>+12.5%</span>
          </div>
          <p className="text-xs text-[#464555] mb-1 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Total Calls Queued</p>
          <h3 className="text-5xl font-bold text-[#1b1b24]" style={{letterSpacing:'-0.02em'}}>{loading ? '—' : stats.total.toLocaleString()}</h3>
        </div>

        {/* Completed Calls */}
        <div className="bg-white border border-zinc-200 p-6 rounded shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600">check_circle</span>
            </div>
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded" style={{fontFamily:'JetBrains Mono, monospace'}}>On Track</span>
          </div>
          <p className="text-xs text-[#464555] mb-1 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Completed Calls</p>
          <h3 className="text-5xl font-bold text-[#1b1b24]" style={{letterSpacing:'-0.02em'}}>{loading ? '—' : stats.completed.toLocaleString()}</h3>
        </div>

        {/* Success Rate */}
        <div className="bg-white border border-zinc-200 p-6 rounded shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-600">trending_up</span>
            </div>
            <span className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded" style={{fontFamily:'JetBrains Mono, monospace'}}>Target 92%</span>
          </div>
          <p className="text-xs text-[#464555] mb-1 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Success Rate %</p>
          <h3 className="text-5xl font-bold text-[#1b1b24]" style={{letterSpacing:'-0.02em'}}>{loading ? '—' : `${successRate}%`}</h3>
        </div>
      </div>

      {/* Bento Row: Pipeline + Health */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* AI Evaluation Pipeline */}
        <div className="lg:col-span-8 bg-white border border-zinc-200 rounded p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-xl font-semibold text-[#1b1b24] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#3525cd]">hub</span>
              AI Evaluation Pipeline
            </h4>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs text-[#464555]" style={{fontFamily:'JetBrains Mono, monospace'}}>Live Analysis Active</span>
            </div>
          </div>
          <div className="space-y-4">
            {pipelineItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-[#f5f2ff] rounded border border-[#c7c4d8]/30">
                <div className="flex items-center gap-4">
                  <span className="material-symbols-outlined text-[#777587]">{item.icon}</span>
                  <div>
                    <p className="text-base font-semibold text-[#1b1b24]">{item.label}</p>
                    <p className="text-xs text-[#464555]" style={{fontFamily:'JetBrains Mono, monospace'}}>{item.sub}</p>
                  </div>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full border ${
                  item.status === 'failed' ? 'bg-[#ffdad6] text-[#ba1a1a] border-[#ba1a1a]/20' :
                  item.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                  'bg-[#e2dfff]/50 text-[#3525cd] border-[#3525cd]/20'
                }`} style={{fontFamily:'JetBrains Mono, monospace'}}>
                  {item.statusLabel}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* System Health */}
          <div className="bg-[#3525cd] text-white p-6 rounded shadow-lg flex-1 relative overflow-hidden group">
            <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-[120px] opacity-10 group-hover:scale-110 transition-transform">auto_awesome</span>
            <h4 className="text-xl font-semibold mb-2 relative z-10">System Health</h4>
            <p className="text-sm text-white/80 mb-6 relative z-10">
              AI processing capacity is currently at {evalProgress.total > 0 ? Math.round((evalProgress.completed / evalProgress.total) * 100) : 74}%. Optimal performance maintained.
            </p>
            <div className="h-2 w-full bg-white/20 rounded-full mb-2 overflow-hidden relative z-10">
              <div className="h-full bg-white rounded-full" style={{width: `${evalProgress.total > 0 ? Math.round((evalProgress.completed / evalProgress.total) * 100) : 74}%`}}></div>
            </div>
            <p className="text-xs text-white font-bold relative z-10" style={{fontFamily:'JetBrains Mono, monospace'}}>
              {evalProgress.total > 0 ? Math.round((evalProgress.completed / evalProgress.total) * 100) : 74}% Capacity
            </p>
          </div>

          {/* Recent Logs */}
          <div className="bg-[#e4e1ee] p-6 rounded border border-zinc-200 flex-1">
            <h4 className="text-xs font-bold text-[#1b1b24] mb-4 uppercase tracking-tighter" style={{fontFamily:'JetBrains Mono, monospace'}}>Recent Logs</h4>
            <div className="space-y-3">
              <div className="flex gap-3 text-sm">
                <span className="text-[#3525cd]" style={{fontFamily:'JetBrains Mono, monospace'}}>12:04</span>
                <span className="text-[#464555]">API Key refreshed successfully.</span>
              </div>
              <div className="flex gap-3 text-sm">
                <span className="text-[#3525cd]" style={{fontFamily:'JetBrains Mono, monospace'}}>11:58</span>
                <span className="text-[#464555]">New campaign initiated.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Campaigns Table */}
      <div className="bg-white border border-zinc-200 rounded shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <h4 className="text-xl font-semibold text-[#1b1b24]">Active Campaigns</h4>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#777587] text-[18px]">filter_list</span>
              <input
                className="w-full bg-[#f0ecf9] border-none rounded py-2 pl-10 pr-4 text-sm text-[#1b1b24] focus:outline-none focus:ring-1 focus:ring-[#3525cd] placeholder:text-[#777587]"
                placeholder="Filter campaigns..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>
            <button className="p-2 border border-[#c7c4d8] rounded hover:bg-[#f0ecf9] transition-colors">
              <span className="material-symbols-outlined text-[#464555]">download</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="px-6 py-4 text-xs text-[#464555] uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Campaign Name</th>
                <th className="px-6 py-4 text-xs text-[#464555] uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Status</th>
                <th className="px-6 py-4 text-xs text-[#464555] uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Contacts</th>
                <th className="px-6 py-4 text-xs text-[#464555] uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Cost/Min</th>
                <th className="px-6 py-4 text-xs text-[#464555] uppercase tracking-wider text-right" style={{fontFamily:'JetBrains Mono, monospace'}}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading && (
                <tr><td colSpan={5} className="px-6 py-12 text-center"><Loader2 className="animate-spin mx-auto text-[#3525cd]" size={24} /></td></tr>
              )}
              {!loading && paginated.map(c => (
                <tr key={c.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-base font-semibold text-[#1b1b24]">{c.name}</span>
                      <span className="text-xs text-[#777587]" style={{fontFamily:'JetBrains Mono, monospace'}}>
                        Created {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={c.status || 'queued'} />
                  </td>
                  <td className="px-6 py-4 text-sm text-[#1b1b24]" style={{fontFamily:'JetBrains Mono, monospace'}}>
                    {c.campaignContacts?.length || 0}
                  </td>
                  <td className="px-6 py-4 text-sm text-[#1b1b24]" style={{fontFamily:'JetBrains Mono, monospace'}}>
                    $0.12
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => openViewModal(c.id)}
                        disabled={loadingCampaignId === c.id}
                        className="p-2 hover:bg-[#e2dfff]/50 text-[#3525cd] transition-colors rounded"
                        title="View"
                      >
                        {loadingCampaignId === c.id
                          ? <Loader2 size={18} className="animate-spin" />
                          : <span className="material-symbols-outlined text-[20px]">visibility</span>}
                      </button>
                      <Link to={`/edit-campaign/${c.id}`} className="p-2 hover:bg-[#f0ecf9] text-[#464555] transition-colors rounded" title="Edit">
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </Link>
                      <Link to={`/campaigns/${c.id}/report`} className="p-2 hover:bg-[#f0ecf9] text-[#464555] transition-colors rounded" title="Report">
                        <span className="material-symbols-outlined text-[20px]">assessment</span>
                      </Link>
                      <Link to={`/campaigns/${c.id}`} className="p-2 hover:bg-[#f0ecf9] text-[#464555] transition-colors rounded" title="Details">
                        <span className="material-symbols-outlined text-[20px]">more_horiz</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredCampaigns.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-[#777587]">No campaigns found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-between items-center">
          <span className="text-xs text-[#464555]" style={{fontFamily:'JetBrains Mono, monospace'}}>
            Showing {paginated.length} of {filteredCampaigns.length} campaigns
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-4 py-2 border border-[#c7c4d8] rounded bg-white text-xs hover:bg-zinc-50 transition-colors disabled:opacity-50"
              style={{fontFamily:'JetBrains Mono, monospace'}}
            >Previous</button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-4 py-2 border border-[#c7c4d8] rounded bg-white text-xs hover:bg-zinc-50 transition-colors disabled:opacity-50"
              style={{fontFamily:'JetBrains Mono, monospace'}}
            >Next</button>
          </div>
        </div>
      </div>

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
