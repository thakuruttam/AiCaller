import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Link } from 'react-router-dom';
import {
  PhoneOutgoing, CheckCircle, TrendingUp, Activity,
  RefreshCw, Eye, Loader2, PlusCircle, ArrowUpRight,
  Clock, XCircle
} from 'lucide-react';
import RoleGate from '../components/RoleGate';
import DebouncedSearch from '../components/DebouncedSearch';
import FullscreenWrapper from '../components/FullscreenWrapper';
import Modal from '../components/Modal';
import Step7Review from './CampaignWizard/components/Step7Review';
import { EVAL_BASE } from '../api/config';

const STATUS_BADGE = {
  completed:   'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-700',
  queued:      'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-slate-700 dark:text-slate-400 dark:ring-slate-600',
  'in-progress':'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-700',
  failed:      'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-700',
  cancelled:   'bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-700',
};

function StatusBadge({ status }) {
  const cls = STATUS_BADGE[status] || STATUS_BADGE.queued;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${cls}`}>
      {status}
    </span>
  );
}

function StatCard({ icon: Icon, iconBg, iconColor, label, value }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-zinc-200/80 dark:border-slate-700 p-6 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.05] hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-500 dark:text-slate-400">{label}</p>
          <p className="mt-2.5 text-3xl font-bold text-zinc-900 dark:text-slate-100 tabular-nums tracking-tight">{value}</p>
        </div>
        <div className={`ml-4 rounded-xl p-3 ${iconBg}`}>
          <Icon size={22} className={iconColor} />
        </div>
      </div>
    </div>
  );
}

const Dashboard = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [evalProgress, setEvalProgress] = useState({ total: 0, completed: 0, failed: 0, inProgress: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [loadingCampaignId, setLoadingCampaignId] = useState(null);

  useEffect(() => { fetchCampaigns(); }, []);

  const fetchCampaigns = async () => {
    try {
      const resCampaigns = await api.get('/api/campaigns');
      const campaignsData = resCampaigns.data;

      const progressPromises = campaignsData.map(c =>
        api.get(`${EVAL_BASE}/reports/campaign/${c.id}/progress`)
           .catch(() => ({ data: { total: 0, completed: 0, failed: 0, inProgress: 0 } }))
      );
      const progressResults = await Promise.all(progressPromises);
      const aggregatedProgress = progressResults.reduce((acc, curr) => {
        acc.total     += curr.data.total     || 0;
        acc.completed += curr.data.completed || 0;
        acc.failed    += curr.data.failed    || 0;
        acc.inProgress+= curr.data.inProgress|| 0;
        return acc;
      }, { total: 0, completed: 0, failed: 0, inProgress: 0 });

      setCampaigns(campaignsData);
      setEvalProgress(aggregatedProgress);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching campaigns', error);
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
  const successRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const filteredCampaigns = campaigns.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="animate-fade-in flex flex-col gap-6 flex-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-slate-100 tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500 dark:text-slate-400 mt-0.5">Monitor your AI calling campaigns</p>
        </div>
        <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']}>
          <Link
            to="/create-campaign"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
          >
            <PlusCircle size={15} />
            New Campaign
          </Link>
        </RoleGate>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={PhoneOutgoing}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
          label="Total Calls Queued"
          value={stats.total}
        />
        <StatCard
          icon={CheckCircle}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          label="Completed Calls"
          value={stats.completed}
        />
        <StatCard
          icon={TrendingUp}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          label="Success Rate"
          value={`${successRate}%`}
        />
      </div>

      {/* Eval pipeline */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-zinc-200/80 dark:border-slate-700 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.05] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50">
              <Activity size={17} className={`text-indigo-600 ${evalProgress.inProgress > 0 ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-slate-100">AI Evaluation Pipeline</h3>
              <p className="text-xs text-zinc-500 dark:text-slate-400">
                {evalProgress.completed + evalProgress.failed} / {evalProgress.total} processed
              </p>
            </div>
          </div>
          <button
            onClick={fetchCampaigns}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50 active:bg-zinc-100 transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'In Progress', value: evalProgress.inProgress, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
            { label: 'Completed',   value: evalProgress.completed,  color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { label: 'Failed',      value: evalProgress.failed,     color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' },
          ].map(({ label, value, color, bg, border }) => (
            <div key={label} className={`rounded-xl border ${bg} ${border} px-4 py-3`}>
              <p className="text-xs font-medium text-zinc-500 dark:text-slate-400 mb-1">{label}</p>
              <p className={`text-2xl font-bold tabular-nums tracking-tight ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Campaigns table */}
      <FullscreenWrapper
        title="Campaigns"
        className="flex-1 min-h-0"
        actionNode={
          <DebouncedSearch
            onSearch={setSearchQuery}
            placeholder="Search campaigns…"
            className="w-60"
          />
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-slate-700 bg-zinc-50/80 dark:bg-slate-800/60">
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">Campaign</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">Type</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">Contacts</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">Created</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-slate-700">
            {filteredCampaigns.map(c => (
              <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-slate-700/50 transition-colors group">
                <td className="px-5 py-4">
                  <span className="font-semibold text-zinc-900 dark:text-slate-100">{c.name}</span>
                </td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
                    {c.type || 'HR'}
                  </span>
                </td>
                <td className="px-5 py-4 text-zinc-600 dark:text-slate-400 tabular-nums">{c.campaignContacts?.length || 0}</td>
                <td className="px-5 py-4 text-zinc-500 dark:text-slate-400 text-xs tabular-nums">
                  {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => openViewModal(c.id)}
                      disabled={loadingCampaignId === c.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50 active:bg-zinc-100 disabled:opacity-50 transition-colors"
                    >
                      {loadingCampaignId === c.id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Eye size={12} />}
                      View
                    </button>
                    <Link
                      to={`/edit-campaign/${c.id}`}
                      className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50 active:bg-zinc-100 transition-colors"
                    >
                      Edit
                    </Link>
                    <Link
                      to={`/campaigns/${c.id}/report`}
                      className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50 active:bg-zinc-100 transition-colors"
                    >
                      <ArrowUpRight size={11} /> Report
                    </Link>
                    <Link
                      to={`/campaigns/${c.id}`}
                      className="inline-flex items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
                    >
                      Details
                    </Link>
                  </div>
                </td>
              </tr>
            ))}

            {campaigns.length > 0 && filteredCampaigns.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-zinc-400 dark:text-slate-500">
                  No campaigns match your search.
                </td>
              </tr>
            )}

            {campaigns.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="px-5 py-16 text-center">
                  <PhoneOutgoing size={36} className="mx-auto text-zinc-200 dark:text-slate-600 mb-4" />
                  <p className="text-sm font-semibold text-zinc-500 dark:text-slate-400">No campaigns yet</p>
                  <p className="text-xs text-zinc-400 dark:text-slate-500 mt-1">Create your first campaign to get started.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </FullscreenWrapper>

      {selectedCampaign && (
        <Modal
          isOpen={isViewModalOpen}
          onClose={() => setIsViewModalOpen(false)}
          title="Campaign Details"
          className="max-w-5xl w-full"
        >
          <div className="max-h-[70vh] overflow-y-auto">
            <Step7Review
              payload={{
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
              }}
            />
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Dashboard;
