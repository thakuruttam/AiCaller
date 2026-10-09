import React, { useEffect, useState } from 'react';
import {
  Button, IconButton, Badge, StatusBadge, Page, PageHeader, BackLink, Card, EmptyState, Avatar, Pagination, Input,
  Table, THead, Th, TBody, Tr, Td, TableToolbar, FilterBar, statusLabel, StatCard, Progress,
} from '../components/ui';
import { useSort } from '../hooks/useSort';
import { useFacets } from '../hooks/useFacets';
import { useCampaignActions, useCallActions } from '../hooks/useCampaignActions';
import CampaignRunControls, { CampaignStateSummary } from '../components/CampaignRunControls';
import { contactProgress, campaignRunState } from '../lib/campaignState';
import { exportCsv } from '../lib/exportCsv';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import PageLoader from '../components/PageLoader';
import SandboxAgent from './CampaignWizard/components/SandboxAgent.jsx';
import Modal from '../components/Modal';
import CampaignTypeLabel from '../components/CampaignTypeLabel';
import ShareCampaignModal from '../components/ShareCampaignModal';

export default function CampaignDetails() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const PER_PAGE = 10;

  useEffect(() => { fetchCampaignDetails(); }, [id]);

  // `quiet` refetches without flashing the page loader — used after a run
  // action and by the live poll below, where the page is already on screen.
  const fetchCampaignDetails = async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get(`/api/campaigns/${id}`);
      setCampaign(res.data);
    } catch (e) {
      console.error(e);
      if (!quiet) setLoadError(e.response?.status === 403 ? 'access-denied' : 'not-found');
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  const campaignActions = useCampaignActions({ onDone: () => fetchCampaignDetails({ quiet: true }) });
  const callActions = useCallActions({ onDone: () => fetchCampaignDetails({ quiet: true }) });

  // While calls are actually in flight this page is the operator's live
  // view, so statuses and durations fill in on their own after pressing
  // Start. Polling stops the moment nothing is live — a finished campaign
  // isn't re-fetched forever in a background tab.
  const runState = campaign ? campaignRunState(campaign) : null;
  useEffect(() => {
    if (runState !== 'running') return;
    const poll = setInterval(() => fetchCampaignDetails({ quiet: true }), 10000);
    return () => clearInterval(poll);
  }, [runState, id]);

  const contacts = campaign?.campaignContacts || [];
  const logs = campaign?.callLogs || [];
  const progress = contactProgress(campaign);
  const completed = logs.filter(l => l.status === 'completed').length;
  const avgDuration = logs.filter(l => l.durationMs).length
    ? Math.round(logs.filter(l => l.durationMs).reduce((a,l) => a + l.durationMs, 0) / logs.filter(l => l.durationMs).length / 1000)
    : 0;
  const successRate = logs.length ? ((completed / logs.length) * 100).toFixed(1) : '0.0';

  // One row per call attempt (not per contact) — a re-run keeps every past
  // completed/failed log (see campaign.controller.js `rerun`), so a contact
  // called multiple times must show each call, each with its own recording
  // and transcript, instead of only the most recent attempt hiding the rest.
  // `logs` is already ordered newest-first from the API. Contacts with no
  // call yet still get a single placeholder row.
  const contactById = new Map(contacts.map(cc => [cc.contactId, cc]));
  const loggedContactIds = new Set(logs.map(l => l.contactId));
  const rows = [
    ...logs.map(log => ({ log, cc: contactById.get(log.contactId) })).filter(r => r.cc),
    ...contacts.filter(cc => !loggedContactIds.has(cc.contactId)).map(cc => ({ log: null, cc })),
  ];

  const filteredRows = rows.filter(({ cc }) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (cc.overrides?.name || cc.contact?.name || '').toLowerCase().includes(q) ||
      (cc.contact?.phone || '').toLowerCase().includes(q) ||
      (cc.overrides?.tag || '').toLowerCase().includes(q)
    );
  });

  const filters = useFacets(
    filteredRows,
    {
      status: {
        label: 'Status',
        get: ({ log }) => (log ? log.status : 'no-call'),
        format: v => (v === 'no-call' ? 'No call' : statusLabel(v)),
      },
      tag: { label: 'Tag', get: ({ cc }) => cc.overrides?.tag },
    },
    { onChange: () => setPage(1) },
  );
  const isFiltered = !!searchQuery || filters.activeCount > 0;
  const clearAllFilters = () => { setSearchQuery(''); filters.reset(); setPage(1); };

  const { sorted: sortedRows, sortProps } = useSort(filters.filtered, {
    name: ({ cc }) => cc.overrides?.name || cc.contact?.name,
    phone: ({ cc }) => cc.contact?.phone,
    calledAt: ({ log }) => log?.createdAt,
    status: ({ log }) => log?.status,
    duration: ({ log }) => log?.durationMs,
  });

  if (loading) return <PageLoader text="Loading campaign…" />;
  if (loadError || !campaign) return (
    <Page>
      <BackLink to="/" className="mb-7">Back to Dashboard</BackLink>
      <Card padded={false}>
        <EmptyState
          icon={loadError === 'access-denied' ? 'lock' : 'search_off'}
          title={loadError === 'access-denied' ? "You don't have access to this campaign" : 'Campaign not found'}
          body={loadError === 'access-denied'
            ? 'Ask a workspace admin for access, or switch to the workspace it belongs to.'
            : 'It may have been deleted, or the link is wrong.'}
        />
      </Card>
    </Page>
  );

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PER_PAGE));

  const handleExport = () => exportCsv(`${campaign.name || 'campaign'}-contacts-${new Date().toISOString().slice(0, 10)}`, [
    { header: 'Name', value: ({ cc }) => cc.overrides?.name || cc.contact?.name },
    { header: 'Phone', value: ({ cc }) => cc.contact?.phone },
    { header: 'Tag', value: ({ cc }) => cc.overrides?.tag },
    { header: 'Called at', value: ({ log }) => log?.createdAt && new Date(log.createdAt).toISOString().slice(0, 10) },
    { header: 'Status', value: ({ log }) => (log ? statusLabel(log.status) : 'no call') },
    { header: 'Duration (s)', value: ({ log }) => (log?.durationMs ? Math.round(log.durationMs / 1000) : null) },
  ], sortedRows);

  const paginated = sortedRows.slice((page-1)*PER_PAGE, page*PER_PAGE);

  return (
    <Page>
      <PageHeader
        back={{ to: '/', label: 'Back to Dashboard' }}
        eyebrow="Campaign"
        title={<>{campaign.name}<CampaignTypeLabel type={campaign.type} className="ml-1 text-sm" /></>}
        // What the campaign is doing, rather than restating its intro line —
        // it sits directly above the buttons that act on it, so the operator
        // can see what Start/Pause/Stop will apply to.
        subtitle={<CampaignStateSummary campaign={campaign} progress={progress} />}
        actions={<>
          {/* Running the campaign is the point of this screen, so it leads. */}
          <CampaignRunControls campaign={campaign} actions={campaignActions} variant="header" />
          <Button as={Link} to={`/edit-campaign/${id}`} variant="secondary" icon="edit">Edit</Button>
          <Button variant="secondary" icon="analytics" as={Link} to={`/campaigns/${id}/report`}>Report</Button>
          <IconButton title="Share a read-only link" icon="share" onClick={() => setShowShare(true)} />
          <IconButton title="Test this script in the AI sandbox" icon="science" onClick={() => setIsSandboxOpen(true)} />
        </>}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-7">
        <StatCard icon="group" label="Total contacts" value={contacts.length.toLocaleString()} />
        <StatCard icon="call" label="Calls completed" value={completed.toLocaleString()}>
          <Progress tone="positive" value={logs.length ? (completed / logs.length) * 100 : 0} />
        </StatCard>
        <StatCard
          icon="timer"
          label="Avg. duration"
          value={avgDuration >= 60 ? `${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s` : `${avgDuration}s`}
        />
        <StatCard icon="trending_up" label="Success rate" value={`${successRate}%`}>
          <Progress value={Number(successRate) || 0} />
        </StatCard>
      </div>

      {/* Activity Table */}
      <Card padded={false} className="overflow-hidden">
        <TableToolbar
          title="Contact call status"
          count={sortedRows.length}
          actions={<>
            <IconButton title="Export CSV" icon="download" onClick={handleExport} disabled={!sortedRows.length} />
          </>}
        >
          <FilterBar filters={filters} />
          <div className="w-full md:w-64 md:ml-auto">
            <Input
              icon="filter_list"
              placeholder="Filter activity..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            />
          </div>
        </TableToolbar>

          <Table>
            <THead>
              <Th {...sortProps('name')}>Name</Th>
              <Th {...sortProps('phone')}>Phone</Th>
              <Th>Tags / Overrides</Th>
              <Th {...sortProps('calledAt')}>Called at</Th>
              <Th {...sortProps('status')}>Status</Th>
              <Th align="right" {...sortProps('duration')}>Duration</Th>
              <Th align="right">Actions</Th>
            </THead>
            <TBody>
              {paginated.map(({ cc, log }) => {
                const contact = cc.contact;
                const name = cc.overrides?.name || contact?.name || '?';
                const status = log?.status;
                const durationMs = log?.durationMs;
                const durationStr = durationMs
                  ? `${Math.floor(durationMs/60000)}m ${Math.round((durationMs%60000)/1000)}s`
                  : '—';

                return (
                  <Tr key={log?.id || cc.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={name} size="sm" />
                        <span className="font-medium">{name}</span>
                      </div>
                    </Td>
                    <Td muted className="tabular-nums whitespace-nowrap">
                      {contact?.phone || '—'}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        {cc.overrides?.tag && (
                          <Badge tone="brand" dot={false} capitalize={false}>{cc.overrides.tag}</Badge>
                        )}
                        {cc.overrides?.goals && (
                          <Badge dot={false} capitalize={false}>Script Override</Badge>
                        )}
                      </div>
                    </Td>
                    <Td muted className="whitespace-nowrap">
                      {log?.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}
                    </Td>
                    <Td>
                      {status ? (
                        <StatusBadge status={status} />
                      ) : (
                        <span className="text-xs text-muted-foreground italic">No call</span>
                      )}
                    </Td>
                    <Td numeric muted>{durationStr}</Td>
                    <Td align="right">
                      {log ? (
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            as={Link}
                            to={`/campaign/${id}/calls/${log.id}`}
                            size="sm"
                            icon="article"
                            title="Open transcript and recording"
                          />
                          {/* Re-score an existing transcript. Only a call
                              that produced one can be re-evaluated —
                              reevaluateCall rejects the rest with a 400. */}
                          <IconButton
                            size="sm"
                            icon="refresh"
                            title={log.status === 'completed'
                              ? 'Re-run the evaluation for this call'
                              : 'Only a completed call can be re-evaluated'}
                            disabled={log.status !== 'completed' || !!callActions.pendingFor(log.id)}
                            loading={callActions.pendingFor(log.id) === 'evaluate'}
                            onClick={() => callActions.reevaluate(log.id)}
                          />
                          <IconButton
                            size="sm"
                            icon="call"
                            tone="brand"
                            title={`Call ${name} again`}
                            disabled={!!callActions.pendingFor(log.id)}
                            loading={callActions.pendingFor(log.id) === 'recall'}
                            onClick={() => callActions.recall(log.id, { contactName: name })}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Not called yet</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    {isFiltered ? (
                      <EmptyState
                        icon="search_off"
                        title="No contacts match your filters"
                        body="Try a different search, or clear the filters."
                        action={<Button variant="secondary" size="sm" onClick={clearAllFilters}>Clear filters</Button>}
                      />
                    ) : (
                      <EmptyState icon="group" title="No contacts in this campaign" body="Add contacts to start placing calls." />
                    )}
                  </td>
                </tr>
              )}
            </TBody>
          </Table>

        <Pagination
          page={page}
          totalPages={totalPages}
          totalRows={sortedRows.length}
          pageSize={PER_PAGE}
          onPageChange={setPage}
          label="contacts"
        />
      </Card>

      <Modal isOpen={isSandboxOpen} onClose={() => setIsSandboxOpen(false)} title="AI Sandbox — Live Test" size="lg">
        <SandboxAgent campaign={campaign} />
      </Modal>

      <ShareCampaignModal campaignId={id} isOpen={showShare} onClose={() => setShowShare(false)} />
    </Page>
  );
}
