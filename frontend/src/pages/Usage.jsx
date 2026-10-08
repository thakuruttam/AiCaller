import React, { useEffect, useState, useCallback } from 'react';
import {
  Page, PageHeader, Table, THead, Th, TBody, Tr, Td, CellStack, StatusBadge, TableToolbar, EmptyState,
  Button, IconButton, FilterBar, StatCard,
} from '../components/ui';
import { useSort } from '../hooks/useSort';
import { useFacets } from '../hooks/useFacets';
import { exportCsv } from '../lib/exportCsv';
import { campaignTypeLabel } from '../components/campaignTypes';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import CampaignTypeLabel from '../components/CampaignTypeLabel';

const NO_CAMPAIGNS = [];

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

function CallRow({ call, campaignId }) {
  const navigate = useNavigate();
  return (
    <Tr onClick={() => navigate(`/campaign/${campaignId}/calls/${call.id}`)}>
      <Td muted className="whitespace-nowrap">{formatDate(call.createdAt)} {formatTime(call.createdAt)}</Td>
      <Td>
        <CellStack title={call.contactName} meta={call.contactPhone} />
      </Td>
      <Td>
        <StatusBadge status={call.status} />
      </Td>
      <Td numeric muted>{formatDuration(call.durationMs)}</Td>
      <Td numeric className="font-medium">
        {call.billableMinutes > 0 ? `${call.billableMinutes} min` : '—'}
      </Td>
      <Td numeric muted>
        {call.billableMinutes > 0 ? `₹${(call.billableMinutes * 5).toLocaleString('en-IN')}` : '—'}
      </Td>
    </Tr>
  );
}

function CampaignRow({ campaign }) {
  const [expanded, setExpanded] = useState(false);
  const hasCalls = campaign.calls.length > 0;

  return (
    <>
      <Tr
        onClick={hasCalls ? () => setExpanded(e => !e) : undefined}
        aria-expanded={hasCalls ? expanded : undefined}
      >
        <Td>
          <div className="flex items-center gap-2 min-w-0">
            {hasCalls ? (
              <span className={`material-symbols-outlined [--icon-size:16px] text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`}>
                chevron_right
              </span>
            ) : (
              <span className="w-4 shrink-0" />
            )}
            <CellStack
              title={campaign.name}
              meta={<>{formatDate(campaign.createdAt)}{campaign.tenantName && <> · {campaign.tenantName}</>}</>}
            />
          </div>
        </Td>
        <Td>
          <CampaignTypeLabel type={campaign.type} />
        </Td>
        <Td numeric muted>
          {campaign.completedCalls} / {campaign.totalCalls}
        </Td>
        <Td numeric>
          <span className="font-semibold">{campaign.totalMinutes.toLocaleString('en-IN')}</span>
          <span className="text-xs text-muted-foreground ml-1">min</span>
        </Td>
        <Td numeric className="font-semibold !text-brand-500">
          {campaign.totalMinutes > 0 ? `₹${(campaign.totalMinutes * 5).toLocaleString('en-IN')}` : '—'}
        </Td>
      </Tr>

      {/* Expanded per-call rows */}
      {expanded && (
        <tr>
          <td colSpan={5} className="p-0 bg-paper-200/50 dark:bg-white/[0.02]">
            <Table>
              <THead>
                <Th>Time</Th>
                <Th>Contact</Th>
                <Th>Status</Th>
                <Th align="right">Duration</Th>
                <Th align="right">Billed</Th>
                <Th align="right">Cost</Th>
              </THead>
              <TBody>
                {campaign.calls.map(call => (
                  <CallRow key={call.id} call={call} campaignId={campaign.id} />
                ))}
              </TBody>
            </Table>
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

  const filters = useFacets(data?.campaigns ?? NO_CAMPAIGNS, {
    type: { label: 'Type', get: c => c.type, format: campaignTypeLabel },
  });

  const { sorted: sortedCampaigns, sortProps } = useSort(filters.filtered, {
    name: c => c.name,
    type: c => c.type,
    calls: c => c.totalCalls,
    minutes: c => c.totalMinutes,
    cost: c => c.totalMinutes,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        <span className="material-symbols-outlined animate-spin text-[20px] mr-2">progress_activity</span>
        Loading usage…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Could not load usage data. Make sure the api-service is running.
      </div>
    );
  }

  const { campaigns, totalMinutes, totalCalls } = data;
  const totalCost = totalMinutes * 5;
  const campaignsWithCalls = campaigns.filter(c => c.totalCalls > 0).length;

  const handleExport = () => exportCsv(`usage-${new Date().toISOString().slice(0, 10)}`, [
    { header: 'Campaign', value: c => c.name },
    { header: 'Type', value: c => campaignTypeLabel(c.type) },
    { header: 'Calls done', value: c => c.completedCalls },
    { header: 'Calls total', value: c => c.totalCalls },
    { header: 'Minutes', value: c => c.totalMinutes },
    { header: 'Cost (INR)', value: c => c.totalMinutes * 5 },
  ], sortedCampaigns);

  return (
    <Page>
      <PageHeader
        title="Usage"
        subtitle="Minute consumption breakdown by campaign and call."
      />

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon="timer"
          label="Total minutes billed"
          value={totalMinutes.toLocaleString('en-IN')}
          hint="Across all campaigns"
        />
        <StatCard
          icon="call"
          label="Total calls made"
          value={totalCalls.toLocaleString('en-IN')}
          hint={`Across ${campaignsWithCalls} campaign${campaignsWithCalls !== 1 ? 's' : ''}`}
        />
        <StatCard
          icon="currency_rupee"
          label="Estimated spend"
          value={totalCost > 0 ? `₹${totalCost.toLocaleString('en-IN')}` : '₹0'}
          hint="At ₹5 / min"
        />
      </div>

      {/* Campaign breakdown */}
      <div className="bg-card dark:bg-muted rounded-2xl shadow-primary overflow-hidden">
        <TableToolbar
          title="Campaign breakdown"
          count={sortedCampaigns.length}
          actions={<IconButton title="Export CSV" icon="download" onClick={handleExport} disabled={!sortedCampaigns.length} />}
        >
          <FilterBar filters={filters} />
          <p className="text-xs text-muted-foreground">Click a row to see per-call details</p>
        </TableToolbar>

        {campaigns.length === 0 ? (
          <EmptyState icon="bar_chart" title="No campaigns yet" body="Usage appears here once a campaign places calls." />
        ) : sortedCampaigns.length === 0 ? (
          <EmptyState
            icon="filter_alt_off"
            title="No campaigns match your filters"
            body="Try a different type, or clear the filters."
            action={<Button variant="secondary" onClick={filters.reset}>Clear filters</Button>}
          />
        ) : (
          <Table>
            <THead>
              <Th {...sortProps('name')}>Campaign</Th>
              <Th {...sortProps('type')}>Type</Th>
              <Th align="right" {...sortProps('calls')}>Calls (done/total)</Th>
              <Th align="right" {...sortProps('minutes')}>Minutes used</Th>
              <Th align="right" {...sortProps('cost')}>Cost</Th>
            </THead>
            <TBody>
              {sortedCampaigns.map(c => (
                <CampaignRow key={c.id} campaign={c} />
              ))}
            </TBody>
          </Table>
        )}
      </div>
  </Page>
  );
}
