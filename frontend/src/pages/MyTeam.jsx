import React, { useEffect, useState } from 'react';
import FullscreenTable, { FullscreenButton } from '../components/FullscreenTable';
import DebouncedSearch from '../components/DebouncedSearch';
import ToggleSwitch from '../components/ToggleSwitch';
import Pagination from '../components/Pagination';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const ROLE_BADGE = {
  SUPER_ADMIN: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700',
  ADMIN:       'bg-[#e2dfff] text-[#0d9488] border-[#0d9488]/20 dark:bg-indigo-900/30 dark:text-teal-300 dark:border-teal-700',
  EDITOR:      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
  VIEWER:      'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600',
};

const ROLES = ['ADMIN', 'EDITOR', 'VIEWER'];

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

  const inputClass = "w-full h-7 px-0.5 pb-1 bg-transparent border-0 border-b-[1.5px] border-[#e2e8f0] dark:border-white/[0.14] rounded-none text-[0.9rem] leading-none text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-[#0d9488] transition-colors";
  const selectClass = `${inputClass} appearance-none`;
  const labelClass = "block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-slate-100">Add Member</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-slate-800 transition-colors">
            <span className="material-symbols-outlined text-zinc-400 text-[18px]">close</span>
          </button>
        </div>

        {!inviteUrl ? (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className={labelClass}>Email <span className="text-red-500">*</span></label>
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
                <label className={labelClass}>First Name <span className="text-red-500">*</span></label>
                <input
                  type="text" required
                  value={form.firstName}
                  onChange={setField('firstName')}
                  placeholder="Jane"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Last Name <span className="text-red-500">*</span></label>
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
                <label className={labelClass}>Role <span className="text-red-500">*</span></label>
                <select
                  value={form.role}
                  onChange={setField('role')}
                  className={selectClass}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit" disabled={loading || !canSubmit}
              className="w-full h-10 bg-[#0d9488] hover:bg-[#0f766e] text-white rounded-lg text-sm font-semibold disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
            >
              {loading
                ? <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Generating…</>
                : 'Create'
              }
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-600 dark:text-slate-400">
              {emailWarning
                ? 'Invite link generated — email not sent'
                : `Invite link generated! Share it with ${form.email}`}
            </p>
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-lg px-3 py-2.5">
              <span className="text-xs text-zinc-600 dark:text-slate-300 truncate flex-1">{inviteUrl}</span>
              <button onClick={copy} className="text-[#0d9488] hover:text-[#1e00a9] shrink-0">
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
              </button>
            </div>
            <button onClick={onClose} className="w-full h-10 border border-zinc-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-zinc-600 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-800 transition-colors">
              Done
            </button>
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

  if (!workspaceId) return (
    <div className="p-8 text-zinc-400 text-sm">No workspace found.</div>
  );

  const filteredMembers = members.filter(m => {
    const q = searchQuery.toLowerCase();
    return !q || m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
  });
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedMembers = filteredMembers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-extrabold text-[#0f172a] dark:text-slate-100 tracking-tight">My Team</h1>
        <p className="text-sm text-[#334155] dark:text-slate-400 mt-1">Manage your workspace members and roles.</p>
      </div>

      {/* Table */}
      <FullscreenTable className="bg-transparent">
        {({ toggle, isFs }) => (
          <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-zinc-100 dark:border-slate-800">
              <DebouncedSearch
                onSearch={(q) => { setSearchQuery(q); setPage(1); }}
                placeholder="Search members..."
                className="w-72"
              />
              <div className="flex items-center gap-1.5">
                <button
                  onClick={loadMembers}
                  title="Refresh"
                  className="p-2 rounded-lg text-zinc-400 dark:text-slate-500 hover:bg-zinc-100 dark:hover:bg-slate-700 hover:text-zinc-700 dark:hover:text-slate-200 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px] block">refresh</span>
                </button>
                <FullscreenButton toggle={toggle} isFs={isFs} />
                {isAdmin && (
                  <button
                    onClick={() => setShowInvite(true)}
                    className="flex items-center gap-1.5 bg-[#0d9488] hover:bg-[#0f766e] text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shadow-sm active:scale-95 ml-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Team
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-32 text-zinc-400 text-sm">Loading…</div>
            ) : members.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <span className="material-symbols-outlined text-zinc-200 dark:text-slate-700 text-[48px]">group</span>
                <p className="text-zinc-400 text-sm">No members yet. Invite someone to get started.</p>
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3">
                <span className="material-symbols-outlined text-zinc-200 dark:text-slate-700 text-[48px]">search_off</span>
                <p className="text-zinc-400 text-sm">No members match your search.</p>
              </div>
            ) : (<>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-slate-900 border-b border-zinc-100 dark:border-slate-800">
                    <tr>
                      <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Name</th>
                      <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Email</th>
                      <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Role</th>
                      <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Created By</th>
                      <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Created Date</th>
                      <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Status</th>
                      {isAdmin && <th className="px-5 py-3.5" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-slate-800">
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
                        <tr key={m.id} className="hover:bg-zinc-50/60 dark:hover:bg-slate-900/60 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#0f766e] flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                                {m.avatarUrl
                                  ? <img src={m.avatarUrl} alt="" className="w-full h-full object-cover" />
                                  : m.name?.charAt(0)?.toUpperCase() || '?'}
                              </div>
                              <p className="font-semibold text-zinc-900 dark:text-slate-100">
                                {m.name}
                                {isSelf && <span className="ml-2 text-xs text-zinc-400 font-normal">(you)</span>}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-zinc-500 dark:text-slate-400">{m.email}</td>
                          <td className="px-5 py-4">
                            {isAdmin && !isSelf ? (
                              <select
                                value={m.workspaceRole}
                                disabled={roleChanging[m.id]}
                                onChange={e => changeRole(m.id, e.target.value)}
                                className="text-xs font-semibold border border-zinc-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-900 text-zinc-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
                              >
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            ) : (
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${ROLE_BADGE[m.workspaceRole] || ROLE_BADGE.VIEWER}`}>
                                {m.workspaceRole}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-zinc-500 dark:text-slate-400">{m.invitedByName || '—'}</td>
                          <td className="px-5 py-4 text-zinc-500 dark:text-slate-400">{new Date(m.joinedAt).toLocaleDateString()}</td>
                          <td className="px-5 py-4">
                            <ToggleSwitch
                              checked={m.status === 'ACTIVE'}
                              disabled={toggleDisabled}
                              title={toggleTitle}
                              onChange={(checked) => changeStatus(m.id, checked ? 'ACTIVE' : 'SUSPENDED')}
                            />
                          </td>
                          {isAdmin && (
                            <td className="px-5 py-4 text-right">
                              {!isSelf && (
                                <button
                                  onClick={() => removeMember(m.id, m.name)}
                                  className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                  <span className="material-symbols-outlined text-[18px]">person_remove</span>
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                totalRows={filteredMembers.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
              />
            </>)}
          </div>
        )}
      </FullscreenTable>

      {isAdmin && (
        <div className="mt-8">
          <p className="text-sm text-zinc-500 dark:text-slate-400 mb-3">
            {invitesLoading ? 'Loading pending invites…' : `${invites.length} pending invite${invites.length !== 1 ? 's' : ''}`}
          </p>
          {!invitesLoading && invites.length > 0 && (
            <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-slate-900 border-b border-zinc-100 dark:border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Email</th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Role</th>
                    <th className="px-5 py-3.5 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Expires</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-slate-800">
                  {invites.map(inv => (
                    <tr key={inv.id} className="hover:bg-zinc-50/60 dark:hover:bg-slate-900/60 transition-colors">
                      <td className="px-5 py-4 text-zinc-900 dark:text-slate-100">{inv.email}</td>
                      <td className="px-5 py-4">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${ROLE_BADGE[inv.role] || ROLE_BADGE.VIEWER}`}>
                          {inv.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-zinc-400">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => copyInviteLink(inv.inviteUrl)}
                            title="Copy invite link"
                            className="p-1.5 text-zinc-400 hover:text-[#0d9488] hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">content_copy</span>
                          </button>
                          <button
                            onClick={() => resendInvite(inv)}
                            title="Resend invite"
                            className="p-1.5 text-zinc-400 hover:text-[#0d9488] hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">send</span>
                          </button>
                          <button
                            onClick={() => revokeInvite(inv.id)}
                            disabled={revokingId === inv.id}
                            title="Revoke invite"
                            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-[18px]">cancel</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
    </div>
  );
}
