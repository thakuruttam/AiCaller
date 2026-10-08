import React, { useEffect, useState } from 'react';
import DebouncedSearch from '../components/DebouncedSearch';
import ToggleSwitch from '../components/ToggleSwitch';
import Pagination from '../components/Pagination';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Page, PageHeader, Card, Button, IconButton, Badge, Select, Avatar, Table, THead, TBody, Th, Tr, Td, CellStack, RowActions, TableToolbar, EmptyState, SkeletonRow, FilterBar } from '../components/ui';
import { useSort } from '../hooks/useSort';
import { useFacets } from '../hooks/useFacets';
import { exportCsv } from '../lib/exportCsv';

const ROLE_BADGE = {
  SUPER_ADMIN: 'bg-brand-100 text-brand-600 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30',
  ADMIN:       'bg-brand-100 text-brand-500 border-brand-500/20 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/30',
  EDITOR:      'bg-caution/10 text-caution-dim border-caution/30 dark:bg-caution/15 dark:text-caution dark:border-caution/15',
  VIEWER:      'bg-paper-400 text-ink-600 border-paper-500 dark:bg-ink-300 dark:text-ink-900 dark:border-ink-400',
};

const ROLES = ['ADMIN', 'EDITOR', 'VIEWER'];

const roleLabel = (role) => {
  const l = String(role ?? '').replace(/_/g, ' ').toLowerCase();
  return l.charAt(0).toUpperCase() + l.slice(1);
};

function InviteModal({ workspaceId, onClose, prefill }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({
    email: prefill?.email || '',
    firstName: prefill?.firstName || '',
    lastName: prefill?.lastName || '',
    contact: prefill?.contact || '',
    role: prefill?.role || 'VIEWER'
  });
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [error, setError] = useState('');
  const [emailWarning, setEmailWarning] = useState(false);

  const setField = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const canSubmit = form.email.trim() && form.firstName.trim() && form.lastName.trim() && form.role;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await api.post(`/api/workspaces/${workspaceId}/invites`, form);
      setInviteUrl(res.data.inviteUrl);
      setEmailWarning(!res.data.emailSent);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate invite');
    } finally { setLoading(false); }
  };

  const copy = () => {
    navigator.clipboard.writeText(inviteUrl);
    addToast('Invite link copied!', 'success');
  };

  const inputClass = "w-full h-7 px-0.5 pb-1 bg-transparent border-0 border-b-[1.5px] border-paper-500 dark:border-white/[0.14] rounded-none text-[0.9rem] leading-none text-ink-100 dark:text-white placeholder:text-ink-800 dark:placeholder:text-ink-600 focus:outline-none focus:border-brand-500 transition-colors";
  const selectClass = `${inputClass} appearance-none`;
  const labelClass = "block text-xs font-medium text-ink-700  mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-card dark:bg-muted rounded-2xl relative shadow-overlay w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-ink-100 dark:text-paper-200">Add Member</h3>
          <IconButton tone="neutral" size="md" title="Close" icon="close" onClick={onClose} />
        </div>

        {!inviteUrl ? (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className={labelClass}>Email <span className="text-negative">*</span></label>
              <input
                type="email" required
                value={form.email}
                onChange={setField('email')}
                placeholder="member@company.com"
                className={inputClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>First Name <span className="text-negative">*</span></label>
                <input
                  type="text" required
                  value={form.firstName}
                  onChange={setField('firstName')}
                  placeholder="Jane"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Last Name <span className="text-negative">*</span></label>
                <input
                  type="text" required
                  value={form.lastName}
                  onChange={setField('lastName')}
                  placeholder="Doe"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Contact No.</label>
                <input
                  type="tel"
                  value={form.contact}
                  onChange={setField('contact')}
                  placeholder="Optional"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Role <span className="text-negative">*</span></label>
                <select
                  value={form.role}
                  onChange={setField('role')}
                  className={selectClass}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            {error && <p className="text-xs text-negative">{error}</p>}
            <Button variant="primary" size="md" type="submit" disabled={loading || !canSubmit}>
              {loading
                ? <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Generating…</>
                : 'Create'
              }
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-600 dark:text-ink-900">
              {emailWarning
                ? 'Invite link generated — email not sent'
                : `Invite link generated! Share it with ${form.email}`}
            </p>
            <div className="flex items-center gap-2 bg-paper-200 dark:bg-ink-50 border border-paper-500 dark:border-ink-400 rounded-control px-3 py-2.5">
              <span className="text-xs text-ink-600 dark:text-ink-900 truncate flex-1">{inviteUrl}</span>
              <IconButton tone="neutral" size="md" title="Content copy" icon="content_copy" onClick={copy} />
            </div>
            <Button variant="secondary" size="md" onClick={onClose} icon="check">Done</Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyTeam() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [roleChanging, setRoleChanging] = useState({});
  const [invites, setInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [revokingId, setRevokingId] = useState(null);
  const [resendPrefill, setResendPrefill] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [statusChanging, setStatusChanging] = useState({});

  const workspaceId = user?.workspaceId;
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.workspaceRole === 'ADMIN';

  useEffect(() => {
    if (workspaceId) {
      loadMembers();
      if (isAdmin) loadInvites();
    }
  }, [workspaceId]);

  const loadMembers = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/workspaces/${workspaceId}/members`);
      setMembers(res.data);
    } catch { addToast('Could not load members', 'error'); }
    finally { setLoading(false); }
  };

  const loadInvites = async () => {
    setInvitesLoading(true);
    try {
      const res = await api.get(`/api/workspaces/${workspaceId}/invites`);
      setInvites(res.data);
    } catch { addToast('Could not load pending invites', 'error'); }
    finally { setInvitesLoading(false); }
  };

  const copyInviteLink = (url) => {
    navigator.clipboard.writeText(url);
    addToast('Invite link copied!', 'success');
  };

  const revokeInvite = async (inviteId) => {
    setRevokingId(inviteId);
    try {
      await api.delete(`/api/workspaces/${workspaceId}/invites/${inviteId}`);
      setInvites(is => is.filter(i => i.id !== inviteId));
      addToast('Invite revoked', 'success');
    } catch { addToast('Failed to revoke invite', 'error'); }
    finally { setRevokingId(null); }
  };

  const resendInvite = (invite) => {
    setResendPrefill({
      email: invite.email,
      firstName: invite.firstName || '',
      lastName: invite.lastName || '',
      contact: invite.phone || '',
      role: invite.role
    });
    setShowInvite(true);
  };

  const changeRole = async (memberId, role) => {
    setRoleChanging(r => ({ ...r, [memberId]: true }));
    try {
      await api.patch(`/api/workspaces/${workspaceId}/members/${memberId}`, { role });
      setMembers(ms => ms.map(m => m.id === memberId ? { ...m, workspaceRole: role } : m));
      addToast('Role updated', 'success');
    } catch { addToast('Failed to update role', 'error'); }
    finally { setRoleChanging(r => ({ ...r, [memberId]: false })); }
  };

  const changeStatus = async (memberId, status) => {
    setStatusChanging(s => ({ ...s, [memberId]: true }));
    try {
      await api.patch(`/api/workspaces/${workspaceId}/members/${memberId}/status`, { status });
      setMembers(ms => ms.map(m => m.id === memberId ? { ...m, status } : m));
      addToast(status === 'ACTIVE' ? 'Member reactivated' : 'Member suspended', 'success');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to update status', 'error');
    } finally {
      setStatusChanging(s => ({ ...s, [memberId]: false }));
    }
  };

  const removeMember = async (memberId, name) => {
    if (!confirm(`Remove ${name} from this workspace?`)) return;
    try {
      await api.delete(`/api/workspaces/${workspaceId}/members/${memberId}`);
      setMembers(ms => ms.filter(m => m.id !== memberId));
      addToast('Member removed', 'success');
    } catch { addToast('Failed to remove member', 'error'); }
  };

  const filters = useFacets(
    members.filter(m => {
      const q = searchQuery.toLowerCase();
      return !q || m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
    }),
    {
      role: { label: 'Role', get: m => m.workspaceRole, format: roleLabel },
      status: { label: 'Active', get: m => m.status, format: v => (v === 'ACTIVE' ? 'Active' : 'Suspended') },
    },
    { onChange: () => setPage(1) },
  );
  const isFiltered = !!searchQuery || filters.activeCount > 0;
  const clearAllFilters = () => {
    setSearchQuery('');
    filters.reset();
    setPage(1);
  };

  const { sorted: filteredMembers, sortProps } = useSort(
    filters.filtered,
    {
      name: m => m.name,
      email: m => m.email,
      role: m => m.workspaceRole,
      invitedBy: m => m.invitedByName,
      joined: m => m.joinedAt,
      status: m => m.status,
    },
  );

  if (!workspaceId) return (
    <Page><EmptyState icon="workspaces" title="No workspace found" body="Pick or create a workspace to manage its members." /></Page>
  );
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedMembers = filteredMembers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExport = () => exportCsv(`team-members-${new Date().toISOString().slice(0, 10)}`, [
    { header: 'Name', value: m => m.name },
    { header: 'Email', value: m => m.email },
    { header: 'Role', value: m => roleLabel(m.workspaceRole) },
    { header: 'Invited by', value: m => m.invitedByName },
    { header: 'Joined', value: m => m.joinedAt && new Date(m.joinedAt).toISOString().slice(0, 10) },
    { header: 'Status', value: m => (m.status === 'ACTIVE' ? 'Active' : 'Suspended') },
  ], filteredMembers);

  return (
    <Page>
      <PageHeader
        title="My Team"
        subtitle="Manage your workspace members and roles."
        actions={isAdmin && (
          <Button icon="person_add" onClick={() => setShowInvite(true)}>Invite member</Button>
        )}
      />

      {/* Table */}
          <Card padded={false} className="overflow-hidden">
            <TableToolbar
              title="Members"
              count={loading ? null : filteredMembers.length}
              actions={<>
                <IconButton title="Export CSV" icon="download" onClick={handleExport} disabled={!filteredMembers.length} />
                <IconButton title="Refresh" icon="refresh" onClick={loadMembers} />
              </>}
            >
              <FilterBar filters={filters} />
              <DebouncedSearch
                value={searchQuery}
                onSearch={(q) => { setSearchQuery(q); setPage(1); }}
                placeholder="Search members..."
                className="w-full md:w-72 md:ml-auto"
              />
            </TableToolbar>

            {loading ? (
              <Table>
                <TBody>
                  {Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} cols={isAdmin ? 7 : 6} />)}
                </TBody>
              </Table>
            ) : members.length === 0 ? (
              <EmptyState
                icon="group"
                title="No members yet"
                body="Invite a teammate to start collaborating in this workspace."
                action={isAdmin && <Button icon="person_add" onClick={() => setShowInvite(true)}>Invite member</Button>}
              />
            ) : filteredMembers.length === 0 ? (
              <EmptyState
                icon="search_off"
                title={isFiltered && filters.activeCount ? 'No members match your filters' : 'No members match your search'}
                body="Try a different name or email, or clear the filters."
                action={isFiltered && <Button variant="secondary" onClick={clearAllFilters}>Clear filters</Button>}
              />
            ) : (<>
              <Table>
                  <THead>
                      <Th {...sortProps('name')}>Name</Th>
                      <Th {...sortProps('email')}>Email</Th>
                      <Th {...sortProps('role')}>Role</Th>
                      <Th {...sortProps('invitedBy')}>Invited by</Th>
                      <Th {...sortProps('joined')}>Joined</Th>
                      <Th {...sortProps('status')}>Active</Th>
                      {isAdmin && <Th align="right"><span className="sr-only">Actions</span></Th>}
                  </THead>
                  <TBody>
                    {paginatedMembers.map(m => {
                      const isSelf = m.id === user?.id;
                      const isSuperAdminTarget = m.globalRole === 'SUPER_ADMIN';
                      const toggleDisabled = !isAdmin || isSelf || isSuperAdminTarget || !!statusChanging[m.id];
                      const toggleTitle = isSelf
                        ? "You can't change your own status"
                        : isSuperAdminTarget
                          ? "Can't change a super admin's status"
                          : undefined;
                      return (
                        <Tr key={m.id}>
                          <Td>
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar name={m.name} src={m.avatarUrl} size="sm" />
                              <CellStack title={<>{m.name}{isSelf && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>}</>} />
                            </div>
                          </Td>
                          <Td muted>{m.email}</Td>
                          <Td>
                            {isAdmin && !isSelf ? (
                              <Select
                                value={m.workspaceRole}
                                disabled={roleChanging[m.id]}
                                onChange={e => changeRole(m.id, e.target.value)}
                                className="!h-8 !text-xs !w-auto"
                              >
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                              </Select>
                            ) : (
                              <Badge tone={m.workspaceRole === 'ADMIN' || m.workspaceRole === 'SUPER_ADMIN' ? 'brand' : 'neutral'}>
                                {m.workspaceRole.replace('_', ' ').toLowerCase()}
                              </Badge>
                            )}
                          </Td>
                          <Td muted>{m.invitedByName || '—'}</Td>
                          <Td muted className="whitespace-nowrap">{new Date(m.joinedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Td>
                          <Td>
                            <ToggleSwitch
                              checked={m.status === 'ACTIVE'}
                              disabled={toggleDisabled}
                              title={toggleTitle}
                              onChange={(checked) => changeStatus(m.id, checked ? 'ACTIVE' : 'SUSPENDED')}
                            />
                          </Td>
                          {isAdmin && (
                            <Td align="right">
                              {!isSelf && (
                                <RowActions>
                                  <IconButton
                                    tone="danger"
                                    size="sm"
                                    title={`Remove ${m.name}`}
                                    icon="person_remove"
                                    onClick={() => removeMember(m.id, m.name)}
                                  />
                                </RowActions>
                              )}
                            </Td>
                          )}
                        </Tr>
                      );
                    })}
                  </TBody>
              </Table>
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                totalRows={filteredMembers.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
              />
            </>)}
          </Card>

      {isAdmin && (
        <div className="mt-6">
          {invitesLoading || invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {invitesLoading ? 'Loading pending invites…' : 'No pending invites'}
            </p>
          ) : (
            <Card padded={false} className="overflow-hidden">
              <TableToolbar title="Pending invites" count={invites.length} />
              <Table>
                <THead>
                    <Th>Email</Th>
                    <Th>Role</Th>
                    <Th>Expires</Th>
                    <Th align="right"><span className="sr-only">Actions</span></Th>
                </THead>
                <TBody>
                  {invites.map(inv => (
                    <Tr key={inv.id}>
                      <Td>{inv.email}</Td>
                      <Td>
                        <Badge tone={inv.role === 'ADMIN' ? 'brand' : 'neutral'}>
                          {inv.role.replace('_', ' ').toLowerCase()}
                        </Badge>
                      </Td>
                      <Td muted className="whitespace-nowrap">
                        {new Date(inv.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Td>
                      <Td align="right">
                        <RowActions>
                          <IconButton size="sm" title="Copy invite link" icon="content_copy"
                            onClick={() => copyInviteLink(inv.inviteUrl)} />
                          <IconButton size="sm" title="Resend invite" icon="send"
                            onClick={() => resendInvite(inv)} />
                          <IconButton size="sm" tone="danger" title="Revoke invite" icon="cancel"
                            disabled={revokingId === inv.id}
                            onClick={() => revokeInvite(inv.id)} />
                        </RowActions>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </Card>
          )}
        </div>
      )}

      {showInvite && (
        <InviteModal
          workspaceId={workspaceId}
          prefill={resendPrefill}
          onClose={() => { setShowInvite(false); setResendPrefill(null); loadMembers(); loadInvites(); }}
        />
      )}
    </Page>
  );
}
