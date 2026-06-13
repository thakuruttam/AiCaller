import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import api from './api/axios';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGate from './components/RoleGate';
import Dashboard from './pages/Dashboard';
import CampaignWizard from './pages/CampaignWizard/CampaignWizard';
import CampaignDetails from './pages/CampaignDetails';
import CallDetails from './pages/CallDetails';
import CampaignReport from './pages/CampaignReport';
import CallReport from './pages/CallReport';
import AdminDashboard from './pages/AdminDashboard';
import Login from './pages/Login';
import ShareView from './pages/ShareView';
import SharedCallReport from './pages/SharedCallReport';
import AuthCallback from './pages/AuthCallback';
import WorkspaceSettings from './pages/WorkspaceSettings';
import InviteAccept from './pages/InviteAccept';
import Support from './pages/Support';
import MyTeam from './pages/MyTeam';
import Billing from './pages/Billing';
import Usage from './pages/Usage';
import { ToastProvider, useToast } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationDropdown from './components/NotificationDropdown';
import './index.css';


function TopBarWorkspacePicker() {
  const { user, workspaces, switchWorkspace, refreshWorkspaces } = useAuth();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [creating, setCreating] = useState(false);
  const ref = useRef(null);

  const current = workspaces.find(w => w.id === user?.workspaceId);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSwitch = async (workspaceId) => {
    if (workspaceId === user?.workspaceId) { setOpen(false); return; }
    setSwitching(workspaceId);
    try {
      await switchWorkspace(workspaceId);
      setOpen(false);
      window.location.reload();
    } catch { /* ignore */ }
    finally { setSwitching(null); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    setCreating(true);
    try {
      const { data } = await api.post('/api/workspaces', { name: newWsName.trim() });
      await refreshWorkspaces();
      await switchWorkspace(data.id);
      setOpen(false);
      setNewWsName('');
      window.location.reload();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to create workspace', 'error');
    } finally {
      setCreating(false);
    }
  };

  if (!current && user?.role !== 'SUPER_ADMIN') return null;

  const initials = current?.name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div ref={ref} className="relative hidden md:block">
      {/* ── Trigger pill — dark, matches sidebar ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 h-8 pl-2 pr-3 rounded-lg transition-all cursor-pointer ${
          open
            ? 'bg-[#0a0f1a] shadow-md'
            : 'bg-[#0a0f1a] hover:bg-[#0d1520]'
        }`}
      >
        <div className="w-5 h-5 rounded-md bg-[#0d9488] flex items-center justify-center shrink-0 text-[10px] font-bold text-white">
          {initials}
        </div>
        <span className="max-w-[110px] truncate text-[12.5px] font-semibold text-white">
          {current?.name || 'No Workspace'}
        </span>
        <span className={`material-symbols-outlined text-[14px] text-[#64748b] transition-transform ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 w-64 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.10)] border border-[#e2e8f0] z-50 overflow-hidden">

          {/* Current workspace header — clean, no gradient */}
          <div className="px-4 py-3.5 border-b border-[#f1f5f9]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0d9488] flex items-center justify-center text-white text-sm font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-[#0f172a] truncate leading-snug">
                  {current?.name || 'No Workspace'}
                </p>
                <p className="text-[11px] text-[#0d9488] font-medium capitalize leading-none mt-0.5">
                  {(current?.role || user?.workspaceRole || user?.role || '').toLowerCase()}
                </p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Active" />
            </div>
          </div>

          {/* Workspace list */}
          {workspaces.length > 1 && (
            <div className="py-1">
              <p className="px-4 pt-2 pb-1.5 text-[10px] font-semibold text-[#94a3b8] uppercase tracking-widest">
                Switch workspace
              </p>
              <div className="max-h-40 overflow-y-auto">
                {workspaces.filter(w => w.id !== user?.workspaceId).map(w => (
                  <button
                    key={w.id}
                    onClick={() => handleSwitch(w.id)}
                    disabled={!!switching}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#f8fafc] group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-md bg-[#f0fdfa] flex items-center justify-center shrink-0 text-xs font-bold text-[#0d9488] group-hover:bg-[#0d9488] group-hover:text-white transition-colors">
                      {switching === w.id
                        ? <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                        : w.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="flex-1 text-[13px] font-medium text-[#334155] truncate group-hover:text-[#0f172a] transition-colors">
                      {w.name}
                    </p>
                    <span className="material-symbols-outlined text-[14px] text-[#cbd5e1] group-hover:text-[#0d9488] transition-colors">
                      chevron_right
                    </span>
                  </button>
                ))}
              </div>
              <div className="mx-4 border-t border-[#f1f5f9]" />
            </div>
          )}

          {/* Create workspace */}
          <div className="p-3">
            {showCreate ? (
              <form onSubmit={handleCreate} className="space-y-2">
                <input
                  autoFocus required value={newWsName}
                  onChange={e => setNewWsName(e.target.value)}
                  placeholder="Workspace name…"
                  className="w-full h-8 px-3 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-[#0d9488]/20 focus:border-[#0d9488] transition-all"
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={creating || !newWsName.trim()}
                    className="flex-1 h-8 bg-[#0d9488] text-white rounded-lg text-xs font-semibold hover:bg-[#0f766e] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                    {creating
                      ? <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                      : <><span className="material-symbols-outlined text-[13px]">add</span>Create</>}
                  </button>
                  <button type="button" onClick={() => { setShowCreate(false); setNewWsName(''); }}
                    className="h-8 px-3 border border-[#e2e8f0] text-[#64748b] rounded-lg text-xs font-medium hover:bg-[#f8fafc] transition-colors cursor-pointer">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] font-medium text-[#64748b] hover:text-[#0d9488] hover:bg-[#f0fdfa] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">add_circle</span>
                New workspace
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BalanceWidget() {
  const [balance, setBalance] = useState(null);
  const location = useLocation();

  useEffect(() => {
    api.get('/api/billing').then(r => setBalance(r.data)).catch(() => {});
  }, [location.pathname]);

  if (balance === null) return null;

  const isLow = balance.minuteBalance <= 30;
  const isDepleted = balance.minuteBalance === 0;

  const borderColor = isDepleted ? 'border-red-700/40' : isLow ? 'border-amber-700/40' : 'border-zinc-700/40';
  const bgColor     = isDepleted ? 'bg-red-900/30'     : isLow ? 'bg-amber-900/30'     : 'bg-zinc-800/60';
  const numColor    = isDepleted ? 'text-red-400'       : isLow ? 'text-amber-400'       : 'text-white';

  return (
    <div className={`mx-3 mb-2 rounded-lg border overflow-hidden ${bgColor} ${borderColor}`}>
      {/* Balance row → goes to /billing */}
      <NavLink to="/billing" className="block px-3 pt-2.5 pb-2 hover:bg-white/5 transition-colors">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Balance</span>
          {isDepleted && <span className="text-[10px] font-bold text-red-400">TOP UP</span>}
          {isLow && !isDepleted && <span className="text-[10px] font-bold text-amber-400">LOW</span>}
        </div>
        <div className="flex items-end gap-1.5">
          <span className={`text-lg font-bold leading-none ${numColor}`}>
            {balance.minuteBalance.toLocaleString('en-IN')}
          </span>
          <span className="text-xs text-zinc-500 mb-0.5">min</span>
        </div>
      </NavLink>

      {/* Usage row → goes to /usage */}
      <NavLink
        to="/usage"
        className="flex items-center justify-between px-3 py-1.5 border-t border-white/10 hover:bg-white/5 transition-colors"
      >
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Usage</span>
        <span className="material-symbols-outlined text-[14px] text-zinc-500">arrow_forward</span>
      </NavLink>
    </div>
  );
}

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItemBase = 'flex items-center gap-3 px-4 py-3 transition-all text-sm font-mono';
  const activeClass = `${navItemBase} text-white bg-zinc-800 border-l-4 border-[#0d9488]`;
  const inactiveClass = `${navItemBase} text-zinc-400 hover:text-white hover:bg-zinc-800/50 border-l-4 border-transparent`;

  const isAt = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-[280px] bg-[#0a0f1a] flex flex-col justify-between py-6 border-r border-white/5 shadow-sm z-50">
      <div className="flex flex-col gap-8">
        <div className="px-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#0f766e] rounded flex items-center justify-center">
            <span className="material-symbols-outlined text-white" style={{fontVariationSettings:"'FILL' 1"}}>graphic_eq</span>
          </div>
          <div>
            <h1 className="font-bold text-white text-base leading-tight">AI Caller Pro</h1>
            <p className="text-zinc-400 text-[11px] uppercase tracking-widest" style={{fontFamily:'JetBrains Mono, monospace'}}>Enterprise Operations</p>
          </div>
        </div>

        <nav className="flex flex-col">
          <NavLink to="/" end className={isAt('/') ? activeClass : inactiveClass}>
            <span className="material-symbols-outlined text-[20px]">dashboard</span>
            <span>Dashboard</span>
          </NavLink>

          <RoleGate allow={['SUPER_ADMIN']}>
            <NavLink to="/admin" className={isAt('/admin') ? activeClass : inactiveClass}>
              <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
              <span>Admin Panel</span>
            </NavLink>
          </RoleGate>
          <NavLink to="/team" className={isAt('/team') ? activeClass : inactiveClass}>
            <span className="material-symbols-outlined text-[20px]">group</span>
            <span>My Team</span>
          </NavLink>
          <NavLink to="/billing" className={isAt('/billing') ? activeClass : inactiveClass}>
            <span className="material-symbols-outlined text-[20px]">payments</span>
            <span>Billing</span>
          </NavLink>
          <NavLink to="/settings/workspace" className={isAt('/settings') ? activeClass : inactiveClass}>
            <span className="material-symbols-outlined text-[20px]">settings</span>
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="px-4">
          <button onClick={() => navigate('/create-campaign')} className="w-full bg-[#0d9488] hover:bg-[#0f766e] text-white py-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-all active:scale-95" style={{fontFamily:'JetBrains Mono, monospace'}}>
            <span className="material-symbols-outlined text-[18px]">campaign</span>
            New Campaign
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1 pt-4">
        <BalanceWidget />
        <div className="border-t border-zinc-800 pt-3 flex flex-col">
          <NavLink
            to="/support"
            className={({ isActive }) => isActive
              ? 'flex items-center gap-3 px-4 py-3 text-white bg-zinc-800/70 rounded-lg text-sm'
              : 'flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all text-left w-full text-sm rounded-lg'
            }
            style={{fontFamily:'JetBrains Mono, monospace'}}
          >
            <span className="material-symbols-outlined text-[20px]">contact_support</span>
            Support
          </NavLink>
          {user && (
            <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors text-left w-full text-sm" style={{fontFamily:'JetBrains Mono, monospace'}}>
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Sign out
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

function TopBar() {
  const { user } = useAuth();
  const initials = user?.name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-280px)] bg-[#f8fafc] flex justify-between items-center px-8 h-16 z-40 border-b border-[#e2e8f0] shadow-sm">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] text-[18px]">search</span>
          <input className="w-full bg-[#f0fdfa] border-none rounded-full py-2 pl-10 pr-4 text-sm text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#0d9488] placeholder:text-[#64748b]" placeholder="Search logs, campaigns..." type="text" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <TopBarWorkspacePicker />
        <NotificationDropdown />
        <div className="h-8 w-px bg-[#cbd5e1] mx-2"></div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden lg:block">
            <p className="text-sm text-[#0f172a] font-medium leading-tight" style={{fontFamily:'JetBrains Mono, monospace'}}>{user?.name || 'User'}</p>
            <p className="text-[10px] text-[#64748b] uppercase tracking-wider">{user?.workspaceRole || user?.role}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#0f766e] flex items-center justify-center text-white text-sm font-bold border border-[#cbd5e1] overflow-hidden shrink-0">
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              : initials}
          </div>
        </div>
      </div>
    </header>
  );
}

function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      <Sidebar />
      <div className="ml-[280px] flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto pt-16">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create-campaign" element={
              <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']} fallback={<div className="flex items-center justify-center h-64 text-[#334155] text-sm">You don't have permission to create campaigns.</div>}>
                <CampaignWizard />
              </RoleGate>
            } />
            <Route path="/edit-campaign/:id" element={
              <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']} fallback={<div className="flex items-center justify-center h-64 text-[#334155] text-sm">You don't have permission to edit campaigns.</div>}>
                <CampaignWizard />
              </RoleGate>
            } />
            <Route path="/admin" element={
              <RoleGate allow={['SUPER_ADMIN']} fallback={<div className="flex items-center justify-center h-64 text-[#334155] text-sm">You don't have permission to access the admin panel.</div>}>
                <AdminDashboard />
              </RoleGate>
            } />
            <Route path="/campaigns/:id" element={<CampaignDetails />} />
            <Route path="/campaigns/:id/report" element={<CampaignReport />} />
            <Route path="/campaign/:campaignId/calls/:id" element={<CallDetails />} />
            <Route path="/campaign/:campaignId/calls/:id/report" element={<CallReport />} />
            <Route path="/settings/workspace" element={<WorkspaceSettings />} />
            <Route path="/team" element={<MyTeam />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/usage" element={<Usage />} />
            <Route path="/support" element={<Support />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/share/:token" element={<ShareView />} />
                <Route path="/share/:token/calls/:callLogId" element={<SharedCallReport />} />
                <Route path="/invite/:token" element={<InviteAccept />} />
                <Route path="/*" element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                } />
              </Routes>
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
