import React, { useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const ROLE_BADGE = {
  SUPER_ADMIN: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700',
  ADMIN:       'bg-[#e2dfff] text-[#0d9488] border-[#0d9488]/20 dark:bg-indigo-900/30 dark:text-teal-300 dark:border-teal-700',
  EDITOR:      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700',
  VIEWER:      'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600',
};


export default function WorkspaceSettings() {
  const { user, workspaces, refreshWorkspaces, refreshUser } = useAuth();
  const { addToast } = useToast();

  const [tab, setTab] = useState('profile');
  const [workspaceName, setWorkspaceName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Profile tab state
  const [profileName, setProfileName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarData, setAvatarData] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const avatarRef = useRef(null);

  const workspaceId = user?.workspaceId;
  const currentWorkspace = workspaces.find(w => w.id === workspaceId);
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.workspaceRole === 'ADMIN';

  // Always refresh workspaces on mount to get latest names
  useEffect(() => {
    if (workspaceId) refreshWorkspaces();
  }, [workspaceId]);

  // Sync profile state from user
  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setAvatarPreview(user.avatarUrl || null);
    }
  }, [user?.id]);

  useEffect(() => {
    if (currentWorkspace) setWorkspaceName(currentWorkspace.name);
  }, [currentWorkspace]);

  const saveName = async () => {
    if (!workspaceName.trim() || workspaceName === currentWorkspace?.name) return;
    setSavingName(true);
    try {
      await api.patch(`/api/workspaces/${workspaceId}`, { name: workspaceName });
      await refreshWorkspaces();
      addToast('Workspace name updated', 'success');
    } catch { addToast('Failed to update name', 'error'); }
    finally { setSavingName(false); }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { addToast('Image must be under 2 MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 256;
        const scale = Math.min(max / img.width, max / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setAvatarPreview(dataUrl);
        setAvatarData(dataUrl);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const saveProfile = async () => {
    if (!profileName.trim()) { addToast('Name cannot be empty', 'error'); return; }
    setSavingProfile(true);
    try {
      const body = { name: profileName };
      if (avatarData !== null) body.avatarUrl = avatarData;
      await api.put('/api/auth/me', body);
      await refreshUser();
      setAvatarData(null);
      addToast('Profile updated', 'success');
    } catch { addToast('Failed to update profile', 'error'); }
    finally { setSavingProfile(false); }
  };

  if (!workspaceId) return (
    <div className="p-8 text-zinc-400 text-sm">No workspace found.</div>
  );

  const tabCls = active => `px-1 pb-3 text-sm font-semibold border-b-2 transition-colors ${active ? 'border-[#0d9488] text-[#0d9488]' : 'border-transparent text-[#334155] hover:text-[#0f172a]'}`;

  const Field = ({ label, children }) => (
    <div>
      <label className="block text-xs font-medium text-[#334155] uppercase tracking-wider mb-2">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="p-8 max-w-[1440px] mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0f172a] dark:text-slate-100 tracking-tight">Settings</h1>
          <p className="text-sm text-[#334155] dark:text-slate-400 mt-1">Manage your profile and workspace configuration.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-zinc-200 mb-8">
        <button className={tabCls(tab === 'profile')} onClick={() => setTab('profile')}>Profile</button>
        <button className={tabCls(tab === 'general')} onClick={() => setTab('general')}>Workspace</button>
      </div>

      {/* ── Profile Tab ─────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Avatar card */}
          <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col items-center text-center gap-4">
            <div className="relative group mt-2">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-[#0f766e] flex items-center justify-center ring-4 ring-offset-2 ring-zinc-100 dark:ring-slate-800">
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="text-3xl font-bold text-white">{user?.name?.charAt(0)?.toUpperCase() || '?'}</span>
                }
              </div>
              <button
                onClick={() => avatarRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
              >
                <span className="material-symbols-outlined text-white text-[22px]">photo_camera</span>
              </button>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0f172a] dark:text-slate-100">{user?.name}</p>
              <p className="text-sm text-[#334155] dark:text-slate-400 mt-0.5">{user?.email}</p>
            </div>
            <div className="flex flex-col items-center gap-2 w-full">
              <button
                onClick={() => avatarRef.current?.click()}
                className="w-full py-2 border border-zinc-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-[#0d9488] hover:bg-[#e6fffa] transition-colors"
              >
                Change photo
              </button>
              {avatarPreview && avatarPreview !== (user?.avatarUrl || null) && (
                <button
                  onClick={() => { setAvatarPreview(user?.avatarUrl || null); setAvatarData(null); }}
                  className="w-full py-2 border border-zinc-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  Remove photo
                </button>
              )}
            </div>
            <div className="w-full pt-4 border-t border-zinc-100 dark:border-slate-800">
              <p className="text-xs font-medium text-[#334155] uppercase tracking-wider mb-2">Workspace Role</p>
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${ROLE_BADGE[user?.workspaceRole || user?.role]}`}>
                {user?.workspaceRole || user?.role}
              </span>
            </div>
          </div>

          {/* Right: Edit form */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-[#0f172a] dark:text-slate-100 mb-6">Personal Information</h3>
            <div className="space-y-5 max-w-lg">
              <Field label="Display Name">
                <input
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  placeholder="Your name"
                  className="w-full h-10 px-3 border border-zinc-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-[#0f172a] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0d9488]"
                />
              </Field>
              <Field label="Email">
                <div className="h-10 px-3 flex items-center bg-zinc-50 dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-lg text-sm text-[#334155] dark:text-slate-400 select-all">
                  {user?.email}
                </div>
                <p className="text-xs text-zinc-400 mt-1">Email cannot be changed here.</p>
              </Field>
            </div>
            <div className="mt-8 pt-5 border-t border-zinc-100 dark:border-slate-800">
              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="flex items-center gap-2 bg-[#0d9488] hover:bg-[#0f766e] text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {savingProfile
                  ? <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Saving…</>
                  : 'Save changes'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Workspace Tab ─────────────────────────────────────────── */}
      {tab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-[#0f172a] dark:text-slate-100 mb-6">Workspace Information</h3>
            <div className="space-y-5 max-w-lg">
              <div>
                <label className="block text-xs font-medium text-[#334155] uppercase tracking-wider mb-2">Workspace Name</label>
                <div className="flex gap-3">
                  <input
                    value={workspaceName}
                    onChange={e => setWorkspaceName(e.target.value)}
                    disabled={!isAdmin}
                    className="flex-1 h-10 px-3 border border-zinc-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 text-[#0f172a] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0d9488] disabled:bg-zinc-50 disabled:text-zinc-400"
                  />
                  {isAdmin && (
                    <button
                      onClick={saveName}
                      disabled={savingName || workspaceName === currentWorkspace?.name}
                      className="px-5 h-10 bg-[#0d9488] text-white rounded-lg text-sm font-semibold hover:bg-[#0f766e] disabled:opacity-40 transition-colors"
                    >
                      {savingName ? 'Saving…' : 'Save'}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] uppercase tracking-wider mb-2">Workspace ID</label>
                <div className="h-10 px-3 flex items-center bg-zinc-50 dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-lg text-xs text-[#334155] select-all">
                  {workspaceId}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#334155] uppercase tracking-wider mb-2">Slug</label>
                <div className="h-10 px-3 flex items-center bg-zinc-50 dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-lg text-sm text-[#334155]">
                  {currentWorkspace?.slug || '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-[#0f172a] dark:text-slate-100 mb-1">Your Access</h3>
            <p className="text-sm text-[#334155] dark:text-slate-400">Your role determines what you can do in this workspace.</p>
            <span className={`self-start text-xs font-medium px-3 py-1.5 rounded-full border mt-2 ${ROLE_BADGE[user?.workspaceRole || user?.role]}`}>
              {user?.workspaceRole || user?.role}
            </span>
          </div>
        </div>
      )}

    </div>
  );
}
