import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Link, useNavigate } from 'react-router-dom';
import Spinner from '../components/Spinner';
import DebouncedSearch from '../components/DebouncedSearch';
import Modal from '../components/Modal';
import Step7Review from './CampaignWizard/components/Step7Review';
import CampaignTypeLabel from '../components/CampaignTypeLabel';
import { campaignTypeLabel } from '../components/campaignTypes';
import { useToast } from '../context/ToastContext';
import {
  Page, Button, IconButton, Input, Pagination,
  Table, THead, TBody, Th, Tr, Td, CellStack, TableToolbar, SkeletonRow,
  FilterBar, ColumnToggle, StatCard, statusLabel,
} from '../components/ui';
import { useSort } from '../hooks/useSort';
import { usePagination } from '../hooks/usePagination';
import { useFacets } from '../hooks/useFacets';
import { useColumnVisibility } from '../hooks/useColumnVisibility';
import { exportCsv } from '../lib/exportCsv';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../pages/web3-dashboard/ui/tooltip';
import {
  PhoneCall, CheckCircle2, TrendingUp, Wallet, FolderSearch, Eye, Pencil, Copy,
} from 'lucide-react';

// The Type and Actions columns pin to the card's edges when the table scrolls
// sideways. Pinned cells need an opaque background to cover what slides under
// them, so the row's translucent hover tint is re-applied as a gradient layer
// over the card colour instead.
const STICKY = 'sticky bg-card dark:bg-muted';
const STICKY_HOVER =
  'group-hover/row:[background-image:linear-gradient(rgb(0_0_0/0.02),rgb(0_0_0/0.02))] ' +
  'dark:group-hover/row:[background-image:linear-gradient(rgb(255_255_255/0.03),rgb(255_255_255/0.03))]';

const STICKY_HEAD =
  'sticky bg-paper-200 dark:bg-muted ' +
  'dark:[background-image:linear-gradient(rgb(255_255_255/0.02),rgb(255_255_255/0.02))]';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'no-answer', 'busy', 'cancelled']);

// Status reads as plain colored text (no pill). Bespoke to campaignStatus()'s
// own 4-state vocabulary below rather than the shared app-wide tone map —
// that map collapses 'active' and 'completed' to the same green "positive"
// tone, which reads as identical colors here. "In progress" and "done" need
// to look different at a glance, so active gets its own brand-blue.
const CAMPAIGN_STATUS_TEXT = {
  draft: 'text-muted-foreground',
  queued: 'text-muted-foreground',
  active: 'text-brand-500',
  completed: 'text-positive',
};

// Latest call log per contact — shared by the progress bar and the status
// derivation below, since Campaign has no native status field in the schema.
function latestLogsByContact(campaign) {
  const latest = {};
  (campaign.callLogs || []).forEach(l => {
    const prev = latest[l.contactId];
    if (!prev || new Date(l.createdAt) > new Date(prev.createdAt)) latest[l.contactId] = l;
  });
  return Object.values(latest);
}

// draft: no contacts added yet. queued: contacts added, no calls placed.
// active: some calls placed, not every contact reached a terminal state.
// completed: every contact has.
function campaignStatus(campaign) {
  const totalContacts = campaign.campaignContacts?.length || 0;
  if (totalContacts === 0) return 'draft';
  if (!campaign.callLogs?.length) return 'queued';
  const contactsDone = latestLogsByContact(campaign).filter(l => TERMINAL_STATUSES.has(l.status)).length;
  return contactsDone >= totalContacts ? 'completed' : 'active';
}

// Contacts-done vs. total contacts drives both the bar's fill % and its
// color: exactly on pace (<=1x) is green, up to double is yellow (a contact
// getting multiple call attempts logged is normal), more than double is red
// — that ratio blowing out is the actual signal something's wrong.
function contactProgress(campaign) {
  const totalContacts = campaign.campaignContacts?.length || 0;
  const contactsDone = latestLogsByContact(campaign).filter(l => TERMINAL_STATUSES.has(l.status)).length;
  return { totalContacts, contactsDone, ratio: totalContacts > 0 ? contactsDone / totalContacts : 0 };
}

function CampaignCostInsight({ campaign }) {
  const { totalContacts, contactsDone, ratio } = contactProgress(campaign);
  const pct = Math.min(Math.round(ratio * 100), 100);
  const barColor = ratio > 2 ? 'bg-negative' : ratio > 1 ? 'bg-caution' : 'bg-positive';

  return (
    <div className="flex flex-col gap-1.5 w-[110px]">
      <div className="text-xs text-muted-foreground tabular-nums">{contactsDone}/{totalContacts} contacts</div>
      <div className="h-1.5 bg-paper-400 dark:bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [loadingCampaignId, setLoadingCampaignId] = useState(null);
  const [cloningId, setCloningId] = useState(null);

  useEffect(() => {
    fetchCampaigns(true);
    const interval = setInterval(() => fetchCampaigns(false), 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchCampaigns = async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      // Always scoped to the current workspace (server-side, by user.workspaceId)
      // regardless of role — a super admin switching workspaces via the picker
      // must see that workspace's campaigns here, not every tenant's at once.
      // Cross-tenant oversight belongs to the Admin Panel's own Campaigns tab.
      const res = await api.get('/api/campaigns');
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

  const handleClone = async (campaignId) => {
    try {
      setCloningId(campaignId);
      const res = await api.post(`/api/campaigns/${campaignId}/clone`);
      addToast('Campaign cloned — add contacts and start when ready.', 'success');
      navigate(`/edit-campaign/${res.data.campaign.id}`);
    } catch (err) {
      console.error('Error cloning campaign:', err);
      addToast('Failed to clone campaign', 'error');
    } finally {
      setCloningId(null);
    }
  };

  const getStats = () => {
    let total = 0, completed = 0, totalSpent = 0;
    campaigns.forEach(c => {
      if (c.callLogs) {
        total      += c.callLogs.length;
        completed  += c.callLogs.filter(l => l.status === 'completed').length;
        // Same real billable-minutes * ₹5/min formula as the per-campaign
        // "Spent" figure in the Cost insight column below.
        totalSpent += c.callLogs.reduce((s, l) => s + (l.billableMinutes || 0), 0) * 5;
      }
    });
    return { total, completed, totalSpent };
  };

  // Real week-over-week change in queued calls: calls logged in the last 7
  // days vs. the 7 days before that, across all campaigns' callLogs.
  const getWeekOverWeekChange = () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    let last7 = 0, prev7 = 0;
    campaigns.forEach(c => {
      (c.callLogs || []).forEach(l => {
        const age = now - new Date(l.createdAt).getTime();
        if (age <= 7 * DAY_MS) last7++;
        else if (age <= 14 * DAY_MS) prev7++;
      });
    });
    if (prev7 === 0) return last7 > 0 ? { pct: null, label: 'New this week' } : null;
    const pct = ((last7 - prev7) / prev7) * 100;
    return { pct, label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` };
  };

  const stats = getStats();
  const weekOverWeek = getWeekOverWeekChange();
  const successRate = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : '0.0';

  const filters = useFacets(
    campaigns.filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase())),
    {
      status: { label: 'Status', get: c => campaignStatus(c), format: statusLabel },
      type: { label: 'Type', get: c => c.type, format: campaignTypeLabel },
      owner: { label: 'Created by', get: c => c.createdBy?.name },
    },
    { onChange: () => resetToFirstPage() },
  );
  const columns = useColumnVisibility('dashboard.campaigns.columns', [
    { key: 'type', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'owner', label: 'Created by' },
    { key: 'progress', label: 'Progress' },
  ]);
  const show = columns.isVisible;
  const isFiltered = !!searchQuery || filters.activeCount > 0;
  const clearAllFilters = () => { setSearchQuery(''); filters.reset(); resetToFirstPage(); };

  const { sorted: filteredCampaigns, sortProps } = useSort(
    filters.filtered,
    {
      type: c => campaignTypeLabel(c.type),
      name: c => c.name,
      status: c => campaignStatus(c),
      owner: c => c.createdBy?.name,
      progress: c => contactProgress(c).ratio,
    },
  );

  const { paginated, setPage, paginationProps } = usePagination(filteredCampaigns);
  // Search and filters live above the pager, so they reset it through here.
  function resetToFirstPage() { setPage(1); }

  const handleExport = () => exportCsv(`campaigns-${new Date().toISOString().slice(0, 10)}`, [
    { header: 'Campaign', value: c => c.name },
    { header: 'Type', value: c => campaignTypeLabel(c.type) },
    { header: 'Status', value: c => statusLabel(campaignStatus(c)) },
    { header: 'Created by', value: c => c.createdBy?.name },
    { header: 'Created', value: c => c.createdAt && new Date(c.createdAt).toISOString().slice(0, 10) },
    { header: 'Contacts done', value: c => contactProgress(c).contactsDone },
    { header: 'Contacts total', value: c => contactProgress(c).totalContacts },
  ], filteredCampaigns);

  return (
    <Page>
      <div className="flex flex-col gap-7">
      {/* KPI strip — the shared StatCard, same tile as every metrics row. */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<PhoneCall className="size-5" />}
          label="Total calls queued"
          value={loading ? '—' : stats.total.toLocaleString()}
          {...(loading
            ? { hint: ' ' }
            : !weekOverWeek
              ? { hint: 'No calls last week' }
              : {
                  trend: {
                    direction: weekOverWeek.pct === null || weekOverWeek.pct >= 0 ? 'up' : 'down',
                    label: weekOverWeek.pct === null ? weekOverWeek.label : `${weekOverWeek.label} this week`,
                  },
                })}
        />
        <StatCard
          icon={<CheckCircle2 className="size-5" />}
          label="Completed calls"
          value={loading ? '—' : stats.completed.toLocaleString()}
          hint="On track"
        />
        <StatCard
          icon={<TrendingUp className="size-5" />}
          label="Success rate"
          value={loading ? '—' : `${successRate}%`}
          hint="Target 92%"
        />
        <StatCard
          icon={<Wallet className="size-5" />}
          label="Total spent"
          value={loading ? '—' : `₹${stats.totalSpent.toLocaleString('en-IN')}`}
          hint="Across all campaigns"
        />
      </div>

      {/* Genuinely zero campaigns (not just a search with no matches) — no
          point showing table chrome (title bar, search, filters, export)
          around nothing to search or export. Just the empty state. */}
      <div>
      {!loading && campaigns.length === 0 ? (
        <div className="flex-1 min-h-[420px] flex flex-col items-center justify-center text-center px-6">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <FolderSearch className="size-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold text-foreground">No campaigns yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Create one to start placing calls.
          </p>
          <Button
            variant="primary"
            size="md"
            icon="campaign"
            className="mt-5"
            onClick={() => navigate('/create-campaign')}
          >
            New Campaign
          </Button>
        </div>
      ) : (
      /* Active Campaigns Table — Watermelon card shell (bg-card/shadow-primary/
          rounded-2xl, same as the KPI cards above), horizontally scrollable
          with the Campaign column pinned left at a fixed width and Actions
          pinned right; every other free-text cell truncates with a tooltip
          for the full value. */
      <div className="bg-card dark:bg-muted rounded-2xl shadow-primary overflow-hidden">
        <div>
          <TableToolbar
            title="Active Campaigns"
            count={loading ? null : filteredCampaigns.length}
            actions={<>
              <ColumnToggle visibility={columns} />
              <IconButton title="Export CSV" icon="download" onClick={handleExport} disabled={!filteredCampaigns.length} />
            </>}
          >
            <FilterBar filters={filters} />
            <div className="w-full md:w-64 md:ml-auto">
              <Input
                icon="filter_list"
                placeholder="Filter campaigns..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>
          </TableToolbar>
        </div>

        <div className="flex flex-col">
        {!loading && filteredCampaigns.length === 0 ? (
          <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center text-center px-6">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderSearch className="size-7 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">
              {isFiltered ? 'No campaigns found' : 'No campaigns yet'}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {isFiltered
                ? "We couldn't find any campaigns matching your search and filters. Try different keywords or clear them."
                : 'Create one to start placing calls.'}
            </p>
            {isFiltered ? (
              <Button
                variant="primary"
                size="md"
                className="mt-5"
                onClick={clearAllFilters}
              >
                Clear filters
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                icon="campaign"
                className="mt-5"
                onClick={() => navigate('/create-campaign')}
              >
                New Campaign
              </Button>
            )}
          </div>
        ) : (
        <Table className="table-fixed">
            <THead>
              {show('type') && <Th {...sortProps('type')} className={`${STICKY_HEAD} left-0 z-20 w-[12%]`}>Type</Th>}
              <Th {...sortProps('name')} className="w-[30%]">Campaign</Th>
              {show('status') && <Th {...sortProps('status')} className="w-[12%]">Status</Th>}
              {show('owner') && <Th {...sortProps('owner')} className="w-[18%]">Created by</Th>}
              {show('progress') && <Th {...sortProps('progress')} className="w-[16%]">Progress</Th>}
              <Th align="right" className={`${STICKY_HEAD} right-0 z-20 w-[12%]`}><span className="sr-only">Actions</span></Th>
            </THead>
            <TBody>
              {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={columns.visibleCount + 2} />)}
              {!loading && paginated.map((c) => {
                return (
                <Tr
                  key={c.id}
                  onClick={() => navigate(`/campaigns/${c.id}/report`)}
                >
                  {show('type') && (
                    <Td className={`${STICKY} ${STICKY_HOVER} left-0 z-10`}>
                      <CampaignTypeLabel type={c.type} />
                    </Td>
                  )}
                  <Td>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="min-w-0">
                          <CellStack
                            title={c.name}
                            meta={`Created ${c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}`}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{c.name}</TooltipContent>
                    </Tooltip>
                  </Td>
                  {show('status') && (
                    <Td>
                      <span className={`text-sm font-medium first-letter:uppercase inline-block ${CAMPAIGN_STATUS_TEXT[campaignStatus(c)]}`}>
                        {statusLabel(campaignStatus(c))}
                      </span>
                    </Td>
                  )}
                  {show('owner') && <Td muted>
                    {c.createdBy?.name ? (
                      <span className="block truncate">{c.createdBy.name}</span>
                    ) : '—'}
                  </Td>}
                  {show('progress') && (
                    <Td>
                      <CampaignCostInsight campaign={c} />
                    </Td>
                  )}
                  <Td
                    align="right"
                    className={`${STICKY} ${STICKY_HOVER} right-0 z-10`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        size="sm"
                        title="Quick view"
                        onClick={() => openViewModal(c.id)}
                        disabled={loadingCampaignId === c.id}
                      >
                        {loadingCampaignId === c.id ? <Spinner size={14} /> : <Eye className="size-4" />}
                      </IconButton>
                      <IconButton size="sm" title="Edit" onClick={() => navigate(`/edit-campaign/${c.id}`)}>
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton
                        size="sm"
                        title="Clone"
                        onClick={() => handleClone(c.id)}
                        disabled={cloningId === c.id}
                      >
                        {cloningId === c.id ? <Spinner size={14} /> : <Copy className="size-4" />}
                      </IconButton>
                    </div>
                  </Td>
                </Tr>
                );
              })}
            </TBody>
        </Table>
        )}
        </div>

        {filteredCampaigns.length > 0 && (
          <Pagination {...paginationProps} label="campaigns" />
        )}
      </div>
      )}
      </div>
      </div>

      {/* View Modal */}
      {selectedCampaign && (
        <Modal isOpen={isViewModalOpen} onClose={() => setIsViewModalOpen(false)} title="Campaign Details" size="2xl">
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
        </Modal>
      )}
    </Page>
  );
};

export default Dashboard;
