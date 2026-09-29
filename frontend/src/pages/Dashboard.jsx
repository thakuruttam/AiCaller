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
import { useToast } from '../context/ToastContext';
import {
  Page, PageHeader, EmptyState, Stat, Card, Button, IconButton, Badge, StatusBadge, Input, Pagination,
  Table, THead, TBody, Th, Tr, Td, RecordLink, SkeletonRow,
} from '../components/ui';

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
        <div className="flex-1 h-1.5 bg-paper-500 dark:bg-ink-400 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: pct === 100 ? '#0fc27b' : '#266df0' }}
          />
        </div>
        <span className="text-xs text-ink-800 dark:text-ink-700 shrink-0">{contactsDone}/{totalContacts}</span>
      </div>
      {/* Metric grid */}
      <div className="grid grid-cols-3 gap-x-3">
        {/* Spent — actual, real billable minutes */}
        <div>
          <p className="text-xs text-ink-700 dark:text-ink-800 leading-none mb-0.5">Spent</p>
          <p className="text-sm font-semibold text-brand-500 leading-none">₹{costIncurred}</p>
        </div>
        {/* Left — estimated remaining */}
        <div>
          <div className="flex items-center gap-0.5 mb-0.5">
            <p className="text-xs text-ink-700 dark:text-ink-800 leading-none">Left</p>
            <span className="text-xs text-caution font-semibold leading-none">~est</span>
          </div>
          <p className="text-sm font-semibold text-caution-dim leading-none">~₹{remainingEstCost}</p>
        </div>
        {/* Total — estimated based on max duration */}
        <div>
          <div className="flex items-center gap-0.5 mb-0.5">
            <p className="text-xs text-ink-700 dark:text-ink-800 leading-none">Total</p>
            <span className="text-xs text-ink-800 dark:text-ink-700 font-semibold leading-none">~est</span>
          </div>
          <p className="text-sm font-semibold text-ink-600 dark:text-ink-900 leading-none">~₹{totalEstCost}</p>
        </div>
      </div>
    </div>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [loadingCampaignId, setLoadingCampaignId] = useState(null);
  const [cloningId, setCloningId] = useState(null);
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
    <Page>
      <PageHeader
        title="Dashboard"
        subtitle="Real-time oversight of enterprise voice operations."
        actions={
          <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']}>
            <Button icon="campaign" size="lg" onClick={() => navigate('/create-campaign')}>
              New Campaign
            </Button>
          </RoleGate>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card interactive>
          <Stat
            icon="queue" tone="brand" label="Total calls queued"
            value={loading ? '—' : stats.total.toLocaleString()}
            badge={<Badge dot={false} tone="brand" className="!text-brand-600 dark:!text-brand-300">+12.5%</Badge>}
          />
        </Card>
        <Card interactive>
          <Stat
            icon="check_circle" tone="positive" label="Completed calls"
            value={loading ? '—' : stats.completed.toLocaleString()}
            badge={<Badge tone="positive">On track</Badge>}
          />
        </Card>
        <Card interactive>
          <Stat
            icon="trending_up" tone="caution" label="Success rate"
            value={loading ? '—' : `${successRate}%`}
            badge={<Badge tone="caution">Target 92%</Badge>}
          />
        </Card>
      </div>

      {/* Active Campaigns Table */}
      <FullscreenTable className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card shadow-card overflow-hidden">
        {({ toggle, isFs }) => {
          const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / PER_PAGE));
          const paginated = isFs ? filteredCampaigns : filteredCampaigns.slice((page - 1) * PER_PAGE, page * PER_PAGE);
          return (<>
        <div className="px-7 py-6 border-b border-paper-400 dark:border-ink-400 flex flex-col md:flex-row justify-between items-center gap-4">
          <h4 className="text-sm font-semibold text-ink-100 dark:text-paper-200">Active Campaigns</h4>
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

        <Table>
            <THead>
              <Th icon="campaign">Campaign</Th>
              {isSuperAdmin && <Th icon="corporate_fare">Workspace</Th>}
              <Th icon="radio_button_checked">Status</Th>
              <Th icon="group">Contacts</Th>
              <Th icon="payments">Cost insight</Th>
              <Th align="right">Actions</Th>
            </THead>
            <TBody>
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <SkeletonRow key={i} cols={isSuperAdmin ? 6 : 5} />
              ))}
              {!loading && paginated.map(c => (
                <Tr key={c.id}>
                  <Td>
                    <div className="flex flex-col">
                      <RecordLink as={Link} to={`/campaigns/${c.id}`}>
                        {c.name}
                      </RecordLink>
                      <span className="text-xs text-ink-700 dark:text-ink-800">
                        Created {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-US', {month:'short', day:'numeric'}) : '—'}
                      </span>
                    </div>
                  </Td>
                  {isSuperAdmin && (
                    <Td>
                      <Badge tone="brand">{c.tenant?.name || '—'}</Badge>
                    </Td>
                  )}
                  <Td>
                    <StatusBadge status={c.status || 'queued'} />
                  </Td>
                  <Td>
                    {c.campaignContacts?.length || 0}
                  </Td>
                  <Td>
                    <CampaignCostInsight campaign={c} />
                  </Td>
                  <Td align="right">
                    <div className="flex justify-end gap-2">
                      <IconButton
                        tone="brand" title="View"
                        onClick={() => openViewModal(c.id)}
                        disabled={loadingCampaignId === c.id}
                      >
                        {loadingCampaignId === c.id
                          ? <Spinner size={18} />
                          : <span className="material-symbols-outlined [--icon-size:20px]">visibility</span>}
                      </IconButton>
                      <IconButton as={Link} to={`/edit-campaign/${c.id}`} title="Edit" icon="edit" />
                      <IconButton
                        title="Clone"
                        onClick={() => handleClone(c.id)}
                        disabled={cloningId === c.id}
                      >
                        {cloningId === c.id
                          ? <Spinner size={18} />
                          : <span className="material-symbols-outlined [--icon-size:20px]">content_copy</span>}
                      </IconButton>
                      <IconButton as={Link} to={`/campaigns/${c.id}/report`} title="Report" icon="assessment" />
                      <IconButton as={Link} to={`/campaigns/${c.id}`} title="Details" icon="more_horiz" />
                    </div>
                  </Td>
                </Tr>
              ))}
              {!loading && filteredCampaigns.length === 0 && (
                <tr>
                  <Td colSpan={isSuperAdmin ? 6 : 5} className="!py-0">
                    <EmptyState
                      icon="campaign"
                      title={searchQuery ? 'No campaigns match that filter' : 'No campaigns yet'}
                      body={searchQuery ? 'Try a different name.' : 'Create one to start placing calls.'}
                    />
                  </Td>
                </tr>
              )}

            </TBody>
        </Table>

        {!isFs && (
          <Pagination
            page={page}
            totalPages={totalPages}
            totalRows={filteredCampaigns.length}
            pageSize={PER_PAGE}
            onPageChange={setPage}
            label="campaigns"
            compact
          />
        )}
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
    </Page>
  );
};

export default Dashboard;
