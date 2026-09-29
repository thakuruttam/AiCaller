import React, { useEffect, useState, useCallback } from 'react';
import { Page, PageHeader } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const STATUS_STYLE = {
  completed:  'bg-positive/10 text-positive-dim dark:bg-positive/15 dark:text-positive',
  failed:     'bg-negative/10 text-negative-dim dark:bg-negative/15 dark:text-negative',
  'no-answer':'bg-paper-400 text-ink-700 dark:bg-ink-200 dark:text-ink-900',
  cancelled:  'bg-paper-400 text-ink-700 dark:bg-ink-200 dark:text-ink-900',
  busy:       'bg-caution/10 text-caution-dim dark:bg-caution/15 dark:text-caution',
  'in-progress':'bg-brand-100 text-brand-600 dark:bg-brand-600/30 dark:text-brand-300',
  queued:     'bg-paper-400 text-ink-700 dark:bg-ink-200 dark:text-ink-900',
};

const CAMPAIGN_TYPE_STYLE = {
  HR:            'bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  RECRUITER:     'bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  SALES:         'bg-brand-100 text-brand-600 dark:bg-brand-600/30 dark:text-brand-300',
  LOAN_RECOVERY: 'bg-negative/10 text-negative-dim dark:bg-negative/15 dark:text-negative',
  FEEDBACK:      'bg-caution/10 text-caution-dim dark:bg-caution/15 dark:text-caution',
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
    <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card p-5 shadow-card flex items-start gap-4">
      <div className="w-10 h-10 rounded-card bg-brand-100 dark:bg-brand-500/15 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-brand-500 text-[20px]">{icon}</span>
      </div>
      <div>
        <p className="text-xs font-medium text-ink-800 ">{label}</p>
        <p className="text-2xl font-bold text-ink-100 dark:text-paper-200 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-ink-800 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function CallRow({ call, campaignId }) {
  const navigate = useNavigate();
  return (
    <tr
      className="hover:bg-paper-200/60 dark:hover:bg-ink-100/60 transition-colors cursor-pointer"
      onClick={() => navigate(`/campaign/${campaignId}/calls/${call.id}`)}
    >
      <td className="px-5 py-3 text-ink-600 dark:text-ink-900 text-xs">{formatDate(call.createdAt)} {formatTime(call.createdAt)}</td>
      <td className="px-5 py-3">
        <p className="text-sm font-medium text-ink-100 dark:text-paper-200">{call.contactName}</p>
        <p className="text-xs text-ink-800">{call.contactPhone}</p>
      </td>
      <td className="px-5 py-3">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[call.status] || 'bg-paper-400 text-ink-700'}`}>
          {call.status}
        </span>
      </td>
      <td className="px-5 py-3 text-sm text-ink-600 dark:text-ink-900">{formatDuration(call.durationMs)}</td>
      <td className="px-5 py-3 text-sm font-semibold text-ink-100 dark:text-paper-200">
        {call.billableMinutes > 0 ? `${call.billableMinutes} min` : '—'}
      </td>
      <td className="px-5 py-3 text-sm text-ink-700 dark:text-ink-900">
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
        className={`border-b border-paper-400 dark:border-ink-400 transition-colors ${hasCalls ? 'cursor-pointer hover:bg-paper-200 dark:hover:bg-ink-100' : ''}`}
      >
        <td className="px-7 py-5">
          <div className="flex items-center gap-2">
            {hasCalls ? (
              <span className={`material-symbols-outlined text-[16px] text-ink-800 transition-transform ${expanded ? 'rotate-90' : ''}`}>
                chevron_right
              </span>
            ) : (
              <span className="w-4" />
            )}
            <div>
              <p className="text-sm font-semibold text-ink-100 dark:text-paper-200">{campaign.name}</p>
              <p className="text-xs text-ink-800">
                {formatDate(campaign.createdAt)}
                {campaign.tenantName && <> · {campaign.tenantName}</>}
              </p>
            </div>
          </div>
        </td>
        <td className="px-7 py-5">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CAMPAIGN_TYPE_STYLE[campaign.type] || 'bg-paper-400 text-ink-700'}`}>
            {campaign.type.replace('_', ' ')}
          </span>
        </td>
        <td className="px-7 py-5 text-sm text-ink-600 dark:text-ink-900">
          {campaign.completedCalls} / {campaign.totalCalls}
        </td>
        <td className="px-7 py-5">
          <span className="text-sm font-bold text-ink-100 dark:text-paper-200">
            {campaign.totalMinutes.toLocaleString('en-IN')}
          </span>
          <span className="text-xs text-ink-800 ml-1">min</span>
        </td>
        <td className="px-7 py-5 text-sm font-semibold text-brand-500">
          {campaign.totalMinutes > 0 ? `₹${(campaign.totalMinutes * 5).toLocaleString('en-IN')}` : '—'}
        </td>
      </tr>

      {/* Expanded per-call rows */}
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0 bg-paper-200/50 dark:bg-ink-300/50">
            <div className="border-t border-paper-400 dark:border-ink-400">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-paper-400/60 dark:bg-ink-200/60">
                    <th className="px-5 py-3 text-left text-xs font-medium text-ink-800 ">Time</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-ink-800 ">Contact</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-ink-800 ">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-ink-800 ">Duration</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-ink-800 ">Billed</th>
                    <th className="px-5 py-3 text-left text-xs font-medium text-ink-800 ">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-paper-400 dark:divide-ink-400">
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
      <div className="flex items-center justify-center h-64 text-ink-800 text-sm">
        <span className="material-symbols-outlined animate-spin text-[20px] mr-2">progress_activity</span>
        Loading usage…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-ink-800 text-sm">
        Could not load usage data. Make sure the api-service is running.
      </div>
    );
  }

  const { campaigns, totalMinutes, totalCalls } = data;
  const totalCost = totalMinutes * 5;
  const campaignsWithCalls = campaigns.filter(c => c.totalCalls > 0).length;

  return (
    <Page className="max-w-[1200px]">
      <PageHeader
        title="Usage"
        subtitle="Minute consumption breakdown by campaign and call."
      />

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
      <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-paper-400 dark:border-ink-400">
          <h2 className="text-sm font-semibold text-ink-100 dark:text-paper-200">Campaign breakdown</h2>
          <p className="text-xs text-ink-800 mt-0.5">Click a row to see per-call details</p>
        </div>

        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <span className="material-symbols-outlined text-paper-200 dark:text-ink-500 text-[40px]">bar_chart</span>
            <p className="text-sm text-ink-800">No campaigns yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper-200 dark:bg-ink-50 border-b border-paper-400 dark:border-ink-400">
              <tr>
                <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 ">Campaign</th>
                <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 ">Type</th>
                <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 ">Calls (done/total)</th>
                <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 ">Minutes used</th>
                <th className="px-7 py-4 text-left text-xs font-medium text-ink-700 ">Cost</th>
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
  </Page>
  );
}
