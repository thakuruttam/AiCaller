import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const STATUS_STYLE = {
  completed:  'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed:     'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  'no-answer':'bg-zinc-100 text-zinc-500 dark:bg-slate-800 dark:text-slate-400',
  cancelled:  'bg-zinc-100 text-zinc-500 dark:bg-slate-800 dark:text-slate-400',
  busy:       'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'in-progress':'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  queued:     'bg-zinc-100 text-zinc-500 dark:bg-slate-800 dark:text-slate-400',
};

const CAMPAIGN_TYPE_STYLE = {
  HR:            'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  RECRUITER:     'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  SALES:         'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  LOAN_RECOVERY: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  FEEDBACK:      'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

function formatDuration(ms) {
  if (!ms) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-800 rounded-xl p-5 shadow-sm flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-[#f0fdfa] dark:bg-[#1e1a3a] flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-[#0d9488] text-[20px]">{icon}</span>
      </div>
      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-[#0f172a] dark:text-slate-100 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function CallRow({ call, campaignId }) {
  const navigate = useNavigate();
  return (
    <tr
      className="hover:bg-zinc-50/60 dark:hover:bg-slate-900/60 transition-colors cursor-pointer"
      onClick={() => navigate(`/campaign/${campaignId}/calls/${call.id}`)}
    >
      <td className="px-4 py-3 text-zinc-600 dark:text-slate-300 text-xs">{formatDate(call.createdAt)} {formatTime(call.createdAt)}</td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-[#0f172a] dark:text-slate-100">{call.contactName}</p>
        <p className="text-xs text-zinc-400 font-mono">{call.contactPhone}</p>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[call.status] || 'bg-zinc-100 text-zinc-500'}`}>
          {call.status}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-slate-300">{formatDuration(call.durationMs)}</td>
      <td className="px-4 py-3 text-sm font-semibold text-[#0f172a] dark:text-slate-100">
        {call.billableMinutes > 0 ? `${call.billableMinutes} min` : '—'}
      </td>
      <td className="px-4 py-3 text-sm text-zinc-500 dark:text-slate-400">
        {call.billableMinutes > 0 ? `₹${(call.billableMinutes * 5).toLocaleString('en-IN')}` : '—'}
      </td>
    </tr>
  );
}

function CampaignRow({ campaign }) {
  const [expanded, setExpanded] = useState(false);
  const hasCalls = campaign.calls.length > 0;

  return (
    <>
      <tr
        onClick={() => hasCalls && setExpanded(e => !e)}
        className={`border-b border-zinc-100 dark:border-slate-800 transition-colors ${hasCalls ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-slate-900' : ''}`}
      >
        <td className="px-5 py-4">
          <div className="flex items-center gap-2">
            {hasCalls ? (
              <span className={`material-symbols-outlined text-[16px] text-zinc-400 transition-transform ${expanded ? 'rotate-90' : ''}`}>
                chevron_right
              </span>
            ) : (
              <span className="w-4" />
            )}
            <div>
              <p className="text-sm font-semibold text-[#0f172a] dark:text-slate-100">{campaign.name}</p>
              <p className="text-xs text-zinc-400">
                {formatDate(campaign.createdAt)}
                {campaign.tenantName && <> · {campaign.tenantName}</>}
              </p>
            </div>
          </div>
        </td>
        <td className="px-5 py-4">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CAMPAIGN_TYPE_STYLE[campaign.type] || 'bg-zinc-100 text-zinc-500'}`}>
            {campaign.type.replace('_', ' ')}
          </span>
        </td>
        <td className="px-5 py-4 text-sm text-zinc-600 dark:text-slate-300">
          {campaign.completedCalls} / {campaign.totalCalls}
        </td>
        <td className="px-5 py-4">
          <span className="text-sm font-bold text-[#0f172a] dark:text-slate-100">
            {campaign.totalMinutes.toLocaleString('en-IN')}
          </span>
          <span className="text-xs text-zinc-400 ml-1">min</span>
        </td>
        <td className="px-5 py-4 text-sm font-semibold text-[#0d9488]">
          {campaign.totalMinutes > 0 ? `₹${(campaign.totalMinutes * 5).toLocaleString('en-IN')}` : '—'}
        </td>
      </tr>

      {/* Expanded per-call rows */}
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0 bg-zinc-50/50 dark:bg-slate-700/50">
            <div className="border-t border-zinc-100 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-zinc-100/60 dark:bg-slate-800/60">
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Time</th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Contact</th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Duration</th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Billed</th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
                  {campaign.calls.map(call => (
                    <CallRow key={call.id} call={call} campaignId={campaign.id} />
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Usage() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data: res } = await api.get(isSuperAdmin ? '/api/billing/usage?all=true' : '/api/billing/usage');
      setData(res);
    } catch {
      addToast('Failed to load usage data', 'error');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 text-sm">
        <span className="material-symbols-outlined animate-spin text-[20px] mr-2">progress_activity</span>
        Loading usage…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-400 text-sm">
        Could not load usage data. Make sure the api-service is running.
      </div>
    );
  }

  const { campaigns, totalMinutes, totalCalls } = data;
  const totalCost = totalMinutes * 5;
  const campaignsWithCalls = campaigns.filter(c => c.totalCalls > 0).length;

  return (
    <div className="p-8 max-w-[1200px] mx-auto">

      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-[#0f172a] dark:text-slate-100 tracking-tight">Usage</h1>
        <p className="text-base text-[#334155] dark:text-slate-400 mt-1">Minute consumption breakdown by campaign and call.</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon="timer"
          label="Total minutes billed"
          value={totalMinutes.toLocaleString('en-IN')}
          sub="across all campaigns"
        />
        <StatCard
          icon="call"
          label="Total calls made"
          value={totalCalls.toLocaleString('en-IN')}
          sub={`across ${campaignsWithCalls} campaign${campaignsWithCalls !== 1 ? 's' : ''}`}
        />
        <StatCard
          icon="currency_rupee"
          label="Estimated spend"
          value={totalCost > 0 ? `₹${totalCost.toLocaleString('en-IN')}` : '₹0'}
          sub="at ₹5 / min"
        />
      </div>

      {/* Campaign breakdown */}
      <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-slate-800">
          <h2 className="text-sm font-semibold text-[#0f172a] dark:text-slate-100">Campaign breakdown</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Click a row to see per-call details</p>
        </div>

        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <span className="material-symbols-outlined text-zinc-200 dark:text-slate-700 text-[40px]">bar_chart</span>
            <p className="text-sm text-zinc-400">No campaigns yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-slate-900 border-b border-zinc-100 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Campaign</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Type</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Calls (done/total)</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Minutes used</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Cost</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <CampaignRow key={c.id} campaign={c} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
