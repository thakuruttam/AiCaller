import React, { useEffect, useRef, useState } from 'react';
import { Page, PageHeader, Button, IconButton, TabBar, Field } from '../components/ui';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const ROLE_BADGE = {
  SUPER_ADMIN: 'bg-brand-100 text-brand-600 border-brand-200 dark:bg-brand-500/15 dark:text-brand-300 dark:border-brand-500/30',
  ADMIN:       'bg-brand-100 text-brand-500 border-brand-500/20 dark:bg-brand-600/30 dark:text-brand-300 dark:border-brand-500/30',
  EDITOR:      'bg-caution/10 text-caution-dim border-caution/30 dark:bg-caution/15 dark:text-caution dark:border-caution/15',
  VIEWER:      'bg-paper-400 text-ink-600 border-paper-500 dark:bg-ink-300 dark:text-ink-900 dark:border-ink-400',
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
    <div className="p-8 text-ink-800 text-sm">No workspace found.</div>
  );

  return (
    <Page>
      <PageHeader
        title="Settings"
        subtitle="Manage your profile and workspace configuration."
      />

      {/* Tabs */}
      <TabBar
        className="mb-8"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'profile', label: 'Profile', icon: 'person' },
          { value: 'general', label: 'Workspace', icon: 'workspaces' },
        ]}
      />

      {/* ── Profile Tab ─────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Avatar card */}
          <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card p-6 shadow-card flex flex-col items-center text-center gap-4">
            <div className="relative group mt-2">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-brand-600 flex items-center justify-center ring-4 ring-offset-2 ring-paper-400 dark:ring-ink-400">
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="text-3xl font-bold text-white">{user?.name?.charAt(0)?.toUpperCase() || '?'}</span>
                }
              </div>
              <IconButton tone="neutral" size="md" title="Photo camera" icon="photo_camera" onClick={() => avatarRef.current?.click()} />
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-100 dark:text-paper-200">{user?.name}</p>
              <p className="text-sm text-ink-600 dark:text-ink-900 mt-0.5">{user?.email}</p>
            </div>
            <div className="flex flex-col items-center gap-2 w-full">
              <Button variant="subtle" size="md" onClick={() => avatarRef.current?.click()}>Change photo</Button>
              {avatarPreview && avatarPreview !== (user?.avatarUrl || null) && (
                <Button variant="dangerGhost" size="md" onClick={() => { setAvatarPreview(user?.avatarUrl || null); setAvatarData(null); }}>Remove photo</Button>
              )}
            </div>
            <div className="w-full pt-4 border-t border-paper-400 dark:border-ink-400">
              <p className="text-xs font-medium text-ink-600 mb-2">Workspace Role</p>
              <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${ROLE_BADGE[user?.workspaceRole || user?.role]}`}>
                {user?.workspaceRole || user?.role}
              </span>
            </div>
          </div>

          {/* Right: Edit form */}
          <div className="lg:col-span-2 bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card p-6 shadow-card">
            <h3 className="text-sm font-semibold text-ink-100 dark:text-paper-200 mb-6">Personal Information</h3>
            <div className="space-y-5 max-w-lg">
              <Field label="Display Name">
                <input
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  placeholder="Your name"
                  className="w-full h-10 px-3 border border-paper-500 dark:border-ink-400 rounded-control text-sm bg-paper-100 dark:bg-ink-50 text-ink-100 dark:text-paper-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </Field>
              <Field label="Email">
                <div className="h-10 px-3 flex items-center bg-paper-200 dark:bg-ink-50 border border-paper-500 dark:border-ink-400 rounded-control text-sm text-ink-600 dark:text-ink-900 select-all">
                  {user?.email}
                </div>
                <p className="text-xs text-ink-800 mt-1">Email cannot be changed here.</p>
              </Field>
            </div>
            <div className="mt-8 pt-5 border-t border-paper-400 dark:border-ink-400">
              <Button variant="primary" size="md" onClick={saveProfile} disabled={savingProfile}>
                {savingProfile
                  ? <><span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span> Saving…</>
                  : 'Save changes'
                }
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Workspace Tab ─────────────────────────────────────────── */}
      {tab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card p-6 shadow-card">
            <h3 className="text-sm font-semibold text-ink-100 dark:text-paper-200 mb-6">Workspace Information</h3>
            <div className="space-y-5 max-w-lg">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-2">Workspace Name</label>
                <div className="flex gap-3">
                  <input
                    value={workspaceName}
                    onChange={e => setWorkspaceName(e.target.value)}
                    disabled={!isAdmin}
                    className="flex-1 h-10 px-3 border border-paper-500 dark:border-ink-400 rounded-control text-sm bg-paper-100 dark:bg-ink-50 text-ink-100 dark:text-paper-200 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-paper-200 disabled:text-ink-800"
                  />
                  {isAdmin && (
                    <Button variant="primary" size="md" onClick={saveName} disabled={savingName || workspaceName === currentWorkspace?.name}>{savingName ? 'Saving…' : 'Save'}</Button>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-2">Workspace ID</label>
                <div className="h-10 px-3 flex items-center bg-paper-200 dark:bg-ink-50 border border-paper-500 dark:border-ink-400 rounded-control text-xs text-ink-600 select-all">
                  {workspaceId}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-2">Slug</label>
                <div className="h-10 px-3 flex items-center bg-paper-200 dark:bg-ink-50 border border-paper-500 dark:border-ink-400 rounded-control text-sm text-ink-600">
                  {currentWorkspace?.slug || '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card p-6 shadow-card flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-ink-100 dark:text-paper-200 mb-1">Your Access</h3>
            <p className="text-sm text-ink-600 dark:text-ink-900">Your role determines what you can do in this workspace.</p>
            <span className={`self-start text-xs font-medium px-3 py-1.5 rounded-full border mt-2 ${ROLE_BADGE[user?.workspaceRole || user?.role]}`}>
              {user?.workspaceRole || user?.role}
            </span>
          </div>
        </div>
      )}
  </Page>
  );
}
