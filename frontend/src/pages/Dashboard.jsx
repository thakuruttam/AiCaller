import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { Link, useNavigate } from 'react-router-dom';
import Spinner from '../components/Spinner';
import FullscreenTable, { FullscreenButton } from '../components/FullscreenTable';
import DebouncedSearch from '../components/DebouncedSearch';
import Modal from '../components/Modal';
import Step7Review from './CampaignWizard/components/Step7Review';
import { useToast } from '../context/ToastContext';
import {
  Page, Button, IconButton, Input, Pagination,
} from '../components/ui';
import {
  Card as StatCard,
  CardHeader as StatCardHeader,
  CardTitle as StatCardTitle,
  CardContent as StatCardContent,
} from '../pages/web3-dashboard/ui/card';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../pages/web3-dashboard/ui/tooltip';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../pages/web3-dashboard/ui/table';
import {
  PhoneCall, CheckCircle2, TrendingUp, Wallet, FolderSearch,
  Users, UserPlus, Banknote, MessageSquare, Briefcase, Eye, Pencil, Copy,
} from 'lucide-react';
import { GoTriangleUp, GoTriangleDown } from 'react-icons/go';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'no-answer', 'busy', 'cancelled']);

// Status reads as plain colored text (no pill). Bespoke to campaignStatus()'s
// own 4-state vocabulary below rather than the shared app-wide tone map —
// that map collapses 'active' and 'completed' to the same green "positive"
// tone, which reads as identical colors here. "In progress" and "done" need
// to look different at a glance, so active gets its own brand-blue.
const CAMPAIGN_STATUS_TEXT = {
  draft: 'text-ink-700 dark:text-ink-800',
  queued: 'text-ink-700 dark:text-ink-800',
  active: 'text-brand-500',
  completed: 'text-positive',
};

// Real enum (api-service/prisma/schema.prisma CampaignType) — one icon/tone
// per type so the table reads at a glance instead of everything being the
// same color.
const CAMPAIGN_TYPE_META = {
  HR: { label: 'HR', icon: Briefcase, tone: 'text-sky-500' },
  RECRUITER: { label: 'Recruiter', icon: UserPlus, tone: 'text-purple-500' },
  SALES: { label: 'Sales', icon: TrendingUp, tone: 'text-emerald-500' },
  LOAN_RECOVERY: { label: 'Loan recovery', icon: Banknote, tone: 'text-orange-500' },
  FEEDBACK: { label: 'Feedback', icon: MessageSquare, tone: 'text-pink-500' },
};
function campaignTypeMeta(type) {
  return CAMPAIGN_TYPE_META[type] || { label: type || 'Campaign', icon: Users, tone: 'text-muted-foreground' };
}

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
function CampaignCostInsight({ campaign }) {
  const totalContacts = campaign.campaignContacts?.length || 0;
  const contactsDone = latestLogsByContact(campaign).filter(l => TERMINAL_STATUSES.has(l.status)).length;
  const ratio = totalContacts > 0 ? contactsDone / totalContacts : 0;
  const pct = Math.min(Math.round(ratio * 100), 100);
  const barColor = ratio > 2 ? '#ff5b59' : ratio > 1 ? '#f5b900' : '#0fc27b';

  return (
    <div className="flex flex-col gap-1.5 w-[110px]">
      <div className="text-xs text-ink-700 dark:text-ink-800">{contactsDone}/{totalContacts} contacts</div>
      <div className="h-1.5 bg-paper-500 dark:bg-ink-400 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: barColor }}
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
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(6);
  const headerBarRef = useRef(null);
  const theadRowRef = useRef(null);
  const firstRowRef = useRef(null);
  const paginationRef = useRef(null);

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

  const filteredCampaigns = campaigns.filter(c =>
    c.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Rows-per-page tracks the actual vertical gap between the header bar and
  // the pagination footer — both measured directly, not estimated — divided
  // by one real rendered row's height. The pagination footer carries its own
  // `mt-auto` so its position never depends on how many rows are currently
  // showing, which is what keeps this from being a circular measurement:
  // the gap we measure is the same gap regardless of the row count we pick,
  // so one measurement pass converges on the right answer instead of
  // chasing a moving target. Floored (never rounded up) so the table never
  // overflows past the page — the worst case is a few unused pixels above
  // the pagination bar, never a clipped row.
  useLayoutEffect(() => {
    const recompute = () => {
      const headerBar = headerBarRef.current;
      const pagination = paginationRef.current;
      const theadRow = theadRowRef.current;
      const firstRow = firstRowRef.current;
      if (!headerBar || !pagination || !theadRow || !firstRow) return;
      const available = pagination.getBoundingClientRect().top - headerBar.getBoundingClientRect().bottom;
      const rowsAvailable = available - theadRow.getBoundingClientRect().height;
      const rowH = firstRow.getBoundingClientRect().height;
      if (rowH <= 0) return;
      const fit = Math.floor(rowsAvailable / rowH);
      setRowsPerPage(Math.max(3, fit));
    };
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [loading, filteredCampaigns.length]);

  const PER_PAGE = rowsPerPage;

  return (
    <div className="bg-paper-300 dark:bg-ink-50 h-full px-4 pb-7 lg:px-8 animate-fade-in flex flex-col">
      {/* Everything below shares one gap-3 grid rhythm — same vertical gap
          between the KPI row and the table as between the KPI cards
          themselves, matching the Watermelon template's own
          `<div className="mx-auto grid gap-4">` wrapper. flex-1 so the
          table below stretches all the way to the bottom of the viewport
          (minus this page's own bottom padding) regardless of row count,
          instead of shrink-wrapping around just a few rows. */}
      <div className="flex flex-1 min-h-0 flex-col gap-8 pt-3">
      {/* KPI Strip — matches the Watermelon template's StatGrid exactly:
          same card shape/shadow, icon-badge layout, and px-4/lg:px-8 gutter
          as the topbar above it (Page's p-5/md:p-10 gutter doesn't line up
          with that, so this page intentionally doesn't use <Page>). */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard className="min-h-28 rounded-2xl bg-card py-4 ring-0 shadow-primary dark:bg-muted">
          <StatCardHeader className="flex items-center gap-2 px-4 pb-2">
            <div className="rounded-full shadow-[inset_0_1px_8px_1px_rgba(255,255,255,0.6),inset_0_-1px_8px_2px_rgba(0,0,0,0.3)] flex items-center justify-center p-2 bg-sky-400">
              <PhoneCall className="size-5 text-black" />
            </div>
            <StatCardTitle className="text-sm font-medium">Total calls queued</StatCardTitle>
          </StatCardHeader>
          <StatCardContent className="px-4 flex flex-col mt-auto">
            <div className="text-3xl font-normal tracking-wide">
              {loading ? '—' : stats.total.toLocaleString()}
            </div>
            {loading || !weekOverWeek ? (
              <div className="mt-2 text-sm text-muted-foreground">
                {loading ? ' ' : 'No calls last week'}
              </div>
            ) : weekOverWeek.pct === null ? (
              <div className="mt-2 flex items-center gap-1 text-sm text-emerald-400">
                <GoTriangleUp className="size-4 fill-current" />
                <span>{weekOverWeek.label}</span>
              </div>
            ) : (
              <div className={`mt-2 flex items-center gap-1 text-sm ${weekOverWeek.pct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {weekOverWeek.pct >= 0
                  ? <GoTriangleUp className="size-4 fill-current" />
                  : <GoTriangleDown className="size-4 fill-current" />}
                <span>{weekOverWeek.label} this week</span>
              </div>
            )}
          </StatCardContent>
        </StatCard>

        <StatCard className="min-h-28 rounded-2xl bg-card py-4 ring-0 shadow-primary dark:bg-muted">
          <StatCardHeader className="flex items-center gap-2 px-4 pb-2">
            <div className="rounded-full shadow-[inset_0_1px_8px_1px_rgba(255,255,255,0.6),inset_0_-1px_8px_2px_rgba(0,0,0,0.3)] flex items-center justify-center p-2 bg-emerald-400">
              <CheckCircle2 className="size-5 text-black" />
            </div>
            <StatCardTitle className="text-sm font-medium">Completed calls</StatCardTitle>
          </StatCardHeader>
          <StatCardContent className="px-4 flex flex-col mt-auto">
            <div className="text-3xl font-normal tracking-wide">
              {loading ? '—' : stats.completed.toLocaleString()}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">On track</div>
          </StatCardContent>
        </StatCard>

        <StatCard className="min-h-28 rounded-2xl bg-card py-4 ring-0 shadow-primary dark:bg-muted">
          <StatCardHeader className="flex items-center gap-2 px-4 pb-2">
            <div className="rounded-full shadow-[inset_0_1px_8px_1px_rgba(255,255,255,0.6),inset_0_-1px_8px_2px_rgba(0,0,0,0.3)] flex items-center justify-center p-2 bg-orange-400">
              <TrendingUp className="size-5 text-black" />
            </div>
            <StatCardTitle className="text-sm font-medium">Success rate</StatCardTitle>
          </StatCardHeader>
          <StatCardContent className="px-4 flex flex-col mt-auto">
            <div className="text-3xl font-normal tracking-wide">
              {loading ? '—' : `${successRate}%`}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">Target 92%</div>
          </StatCardContent>
        </StatCard>

        <StatCard className="min-h-28 rounded-2xl bg-card py-4 ring-0 shadow-primary dark:bg-muted">
          <StatCardHeader className="flex items-center gap-2 px-4 pb-2">
            <div className="rounded-full shadow-[inset_0_1px_8px_1px_rgba(255,255,255,0.6),inset_0_-1px_8px_2px_rgba(0,0,0,0.3)] flex items-center justify-center p-2 bg-lime-400">
              <Wallet className="size-5 text-black" />
            </div>
            <StatCardTitle className="text-sm font-medium">Total spent</StatCardTitle>
          </StatCardHeader>
          <StatCardContent className="px-4 flex flex-col mt-auto">
            <div className="text-3xl font-normal tracking-wide">
              {loading ? '—' : `₹${stats.totalSpent.toLocaleString('en-IN')}`}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">Across all campaigns</div>
          </StatCardContent>
        </StatCard>
      </div>

      {/* Genuinely zero campaigns (not just a search with no matches) — no
          point showing table chrome (title bar, search, export, fullscreen)
          around nothing to search or export. Just the empty state. This
          whole block (either branch) is flex-1 so it stretches to the
          bottom of the page regardless of how many rows render. */}
      <div className="flex-1 min-h-0 flex flex-col">
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
      <FullscreenTable className="bg-card dark:bg-muted rounded-2xl ring-0 shadow-primary overflow-hidden flex-1 min-h-0 flex flex-col">
        {({ toggle, isFs }) => {
          const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / PER_PAGE));
          const paginated = isFs ? filteredCampaigns : filteredCampaigns.slice((page - 1) * PER_PAGE, page * PER_PAGE);
          return (<>
        <div ref={headerBarRef} className="shrink-0 px-6 py-5 border-b border-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h4 className="text-sm font-semibold text-foreground">Active Campaigns</h4>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex-1 md:w-64">
              <Input
                icon="filter_list"
                placeholder="Filter campaigns..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              />
            </div>
            <Button variant="secondary" size="md" icon="download" aria-label="Export" className="!px-3" />
            <FullscreenButton toggle={toggle} isFs={isFs} />
          </div>
        </div>

        <div className="flex flex-col">
        {!loading && filteredCampaigns.length === 0 ? (
          <div className="flex-1 min-h-[360px] flex flex-col items-center justify-center text-center px-6">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderSearch className="size-7 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold text-foreground">
              {searchQuery ? 'No campaigns found' : 'No campaigns yet'}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {searchQuery
                ? "We couldn't find any campaigns matching your search. Try different keywords or clear the filter."
                : 'Create one to start placing calls.'}
            </p>
            {searchQuery ? (
              <Button
                variant="primary"
                size="md"
                className="mt-5"
                onClick={() => { setSearchQuery(''); setPage(1); }}
              >
                Clear search
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
            <TableHeader className="bg-card dark:bg-muted">
              <TableRow ref={theadRowRef} className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-20 bg-card dark:bg-muted w-[10%] px-6 text-muted-foreground">Type</TableHead>
                <TableHead className="w-[30%] px-5 text-muted-foreground">Campaign</TableHead>
                <TableHead className="w-[12%] px-5 text-muted-foreground">Status</TableHead>
                <TableHead className="w-[18%] px-5 text-muted-foreground">Created by</TableHead>
                <TableHead className="w-[18%] px-5 text-muted-foreground">Progress</TableHead>
                <TableHead align="right" className="sticky right-0 z-20 bg-card dark:bg-muted w-[12%] text-right px-6 text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j} className="py-4 px-5">
                      <div className="h-4 bg-paper-400 dark:bg-ink-400 rounded-field animate-pulse" style={{ width: `${40 + ((j * 17) % 45)}%` }} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {!loading && paginated.map((c, i) => {
                const typeMeta = campaignTypeMeta(c.type);
                const TypeIcon = typeMeta.icon;
                // Every cell carries its own hover background rather than
                // relying on the row's bg bleeding through — the vendored
                // TableRow component ships its own hard-coded hover:bg-muted/50
                // that Tailwind's class-merge doesn't know conflicts with our
                // custom paper-200 color (it's not in twMerge's built-in
                // palette), so the row's own background silently lost that
                // fight. Keeping every cell self-sufficient sidesteps it.
                const cellHoverCls = 'group-hover:bg-paper-200 transition-colors';
                return (
                <TableRow
                  key={c.id}
                  ref={i === 0 ? firstRowRef : undefined}
                  onClick={() => navigate(`/campaigns/${c.id}/report`)}
                  className="group cursor-pointer whitespace-normal"
                >
                  <TableCell className={`sticky left-0 z-10 bg-card px-6 py-5 ${cellHoverCls}`}>
                    <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${typeMeta.tone}`}>
                      <TypeIcon className="size-4" />
                      {typeMeta.label}
                    </span>
                  </TableCell>
                  <TableCell className={`px-5 py-5 ${cellHoverCls}`}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium text-ink-100 dark:text-paper-200 truncate">
                            {c.name}
                          </span>
                          <span className="text-xs text-ink-700 dark:text-ink-800 truncate">
                            Created {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '—'}
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{c.name}</TooltipContent>
                    </Tooltip>
                  </TableCell>
                  <TableCell className={`px-5 py-5 ${cellHoverCls}`}>
                    <span className={`text-sm font-medium capitalize ${CAMPAIGN_STATUS_TEXT[campaignStatus(c)]}`}>
                      {campaignStatus(c)}
                    </span>
                  </TableCell>
                  <TableCell className={`px-5 py-5 ${cellHoverCls}`}>
                    {c.createdBy?.name ? (
                      <span className="text-sm text-ink-600 dark:text-ink-900 truncate max-w-[120px]">
                        {c.createdBy.name}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className={`px-5 py-5 ${cellHoverCls}`}>
                    <CampaignCostInsight campaign={c} />
                  </TableCell>
                  <TableCell
                    align="right"
                    className={`sticky right-0 z-10 bg-card text-right px-6 py-5 ${cellHoverCls}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-end gap-1">
                      <IconButton
                        title="Quick view"
                        onClick={() => openViewModal(c.id)}
                        disabled={loadingCampaignId === c.id}
                      >
                        {loadingCampaignId === c.id ? <Spinner size={14} /> : <Eye className="size-4" />}
                      </IconButton>
                      <IconButton title="Edit" onClick={() => navigate(`/edit-campaign/${c.id}`)}>
                        <Pencil className="size-4" />
                      </IconButton>
                      <IconButton
                        title="Clone"
                        onClick={() => handleClone(c.id)}
                        disabled={cloningId === c.id}
                      >
                        {cloningId === c.id ? <Spinner size={14} /> : <Copy className="size-4" />}
                      </IconButton>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
        </Table>
        )}
        </div>

        {!isFs && filteredCampaigns.length > 0 && (
          <div ref={paginationRef} className="mt-auto shrink-0">
            <Pagination
              page={page}
              totalPages={totalPages}
              totalRows={filteredCampaigns.length}
              pageSize={PER_PAGE}
              onPageChange={setPage}
              label="campaigns"
              compact
            />
          </div>
        )}
        </>);
        }}
      </FullscreenTable>
      )}
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
