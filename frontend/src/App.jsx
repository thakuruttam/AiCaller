import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import api from './api/axios';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGate from './components/RoleGate';
import Landing from './pages/Landing';
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
import Docs from './pages/Docs';
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
        <div className="absolute top-[calc(100%+8px)] right-0 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.10)] border border-[#e2e8f0] dark:border-slate-700 z-50 overflow-hidden">

          {/* Current workspace header — clean, no gradient */}
          <div className="px-4 py-3.5 border-b border-[#f1f5f9] dark:border-slate-700/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0d9488] flex items-center justify-center text-white text-sm font-bold shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-[#0f172a] dark:text-slate-100 truncate leading-snug">
                  {current?.name || 'No Workspace'}
                </p>
                <p className="text-[11px] text-[#0d9488] dark:text-teal-400 font-medium capitalize leading-none mt-0.5">
                  {(current?.role || user?.workspaceRole || user?.role || '').toLowerCase()}
                </p>
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Active" />
            </div>
          </div>

          {/* Workspace list */}
          {workspaces.length > 1 && (
            <div className="py-1">
              <p className="px-4 pt-2 pb-1.5 text-[10px] font-semibold text-[#94a3b8] dark:text-slate-500 uppercase tracking-widest">
                Switch workspace
              </p>
              <div className="max-h-40 overflow-y-auto">
                {workspaces.filter(w => w.id !== user?.workspaceId).map(w => (
                  <button
                    key={w.id}
                    onClick={() => handleSwitch(w.id)}
                    disabled={!!switching}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#f8fafc] dark:hover:bg-slate-700/50 group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-md bg-[#f0fdfa] dark:bg-slate-700 flex items-center justify-center shrink-0 text-xs font-bold text-[#0d9488] dark:text-teal-400 group-hover:bg-[#0d9488] group-hover:text-white transition-colors">
                      {switching === w.id
                        ? <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                        : w.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="flex-1 text-[13px] font-medium text-[#334155] dark:text-slate-300 truncate group-hover:text-[#0f172a] dark:group-hover:text-slate-100 transition-colors">
                      {w.name}
                    </p>
                    <span className="material-symbols-outlined text-[14px] text-[#cbd5e1] dark:text-slate-600 group-hover:text-[#0d9488] dark:group-hover:text-teal-400 transition-colors">
                      chevron_right
                    </span>
                  </button>
                ))}
              </div>
              <div className="mx-4 border-t border-[#f1f5f9] dark:border-slate-700/50" />
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
                  className="w-full h-8 px-3 bg-[#f8fafc] dark:bg-slate-700 border border-[#e2e8f0] dark:border-slate-600 rounded-lg text-sm text-[#0f172a] dark:text-slate-100 placeholder:text-[#94a3b8] dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0d9488]/20 focus:border-[#0d9488] transition-all"
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={creating || !newWsName.trim()}
                    className="flex-1 h-8 bg-[#0d9488] text-white rounded-lg text-xs font-semibold hover:bg-[#0f766e] disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
                    {creating
                      ? <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                      : <><span className="material-symbols-outlined text-[13px]">add</span>Create</>}
                  </button>
                  <button type="button" onClick={() => { setShowCreate(false); setNewWsName(''); }}
                    className="h-8 px-3 border border-[#e2e8f0] dark:border-slate-600 text-[#64748b] dark:text-slate-400 rounded-lg text-xs font-medium hover:bg-[#f8fafc] dark:hover:bg-slate-700 transition-colors cursor-pointer">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12.5px] font-medium text-[#64748b] dark:text-slate-400 hover:text-[#0d9488] dark:hover:text-teal-400 hover:bg-[#f0fdfa] dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
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

  const borderColor = isDepleted ? 'border-red-300 dark:border-red-700/40' : isLow ? 'border-amber-300 dark:border-amber-700/40' : 'border-[#e2e8f0] dark:border-zinc-700/40';
  const bgColor     = isDepleted ? 'bg-red-50 dark:bg-red-900/30'          : isLow ? 'bg-amber-50 dark:bg-amber-900/30'          : 'bg-[#f8fafc] dark:bg-zinc-800/60';
  const numColor    = isDepleted ? 'text-red-600 dark:text-red-400'        : isLow ? 'text-amber-600 dark:text-amber-400'        : 'text-[#0f172a] dark:text-white';

  return (
    <div className={`mx-3 mb-2 rounded-lg border overflow-hidden ${bgColor} ${borderColor}`}>
      {/* Balance row → goes to /billing */}
      <NavLink to="/billing" className="block px-3 pt-2.5 pb-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-[#64748b] dark:text-zinc-400 uppercase tracking-wider">Balance</span>
          {isDepleted && <span className="text-[10px] font-bold text-red-600 dark:text-red-400">TOP UP</span>}
          {isLow && !isDepleted && <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">LOW</span>}
        </div>
        <div className="flex items-end gap-1.5">
          <span className={`text-lg font-bold leading-none ${numColor}`}>
            {balance.minuteBalance.toLocaleString('en-IN')}
          </span>
          <span className="text-xs text-[#64748b] dark:text-zinc-500 mb-0.5">min</span>
        </div>
      </NavLink>

      {/* Usage row → goes to /usage */}
      <NavLink
        to="/usage"
        className="flex items-center justify-between px-3 py-1.5 border-t border-[#e2e8f0] dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
      >
        <span className="text-[10px] font-semibold text-[#64748b] dark:text-zinc-400 uppercase tracking-wider">Usage</span>
        <span className="material-symbols-outlined text-[14px] text-[#94a3b8] dark:text-zinc-500">arrow_forward</span>
      </NavLink>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg text-[#64748b] dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="material-symbols-outlined text-[20px] block">{isDark ? 'light_mode' : 'dark_mode'}</span>
    </button>
  );
}

export const SIDEBAR_WIDTH = 280;
export const SIDEBAR_WIDTH_COLLAPSED = 76;

// Icon sits centered in a fixed-width slot (matching the collapsed rail width,
// minus the 4px border-l-4 every nav item carries for its active-state accent)
// so it's always in the same spot whether the sidebar is collapsed or
// expanded — the label just appears to the right of that slot, so the icon
// itself never moves during the collapse/expand transition. Sized to the
// border-reduced width (not the full rail width) so it doesn't overflow past
// the item's own edge, which would off-center it relative to the header's
// hamburger/chevron toggle (whose wrapper carries a matching transparent
// border-l-4 so both land on the same center).
const NavIcon = ({ children }) => (
  <span className="shrink-0 flex items-center justify-center" style={{ width: `${SIDEBAR_WIDTH_COLLAPSED - 4}px` }}>
    <span className="material-symbols-outlined [--icon-size:16px]">{children}</span>
  </span>
);

// Always mounted (never conditionally rendered) so the label fades and
// collapses its own width in sync with the sidebar's width transition,
// instead of popping in/out instantly — that instant swap was what made the
// icon beside it look like it "jumped" and made the whole toggle feel choppy,
// since one axis (label) changed in a single frame while the other (sidebar
// width) was still 200ms into animating.
const NavLabel = ({ collapsed, children }) => (
  <span
    className={`whitespace-nowrap overflow-hidden transition-all duration-200 ease-in-out ${collapsed ? 'opacity-0 max-w-0' : 'opacity-100 max-w-[160px]'}`}
  >
    {children}
  </span>
);

function Sidebar({ collapsed, onToggleCollapse }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItemBase = `flex items-center py-2.5 transition-all text-sm`;
  const activeClass = `${navItemBase} text-[#0d9488] dark:text-white bg-[#e6fffa] dark:bg-zinc-800 border-l-4 border-[#0d9488]`;
  const inactiveClass = `${navItemBase} text-[#475569] dark:text-zinc-400 hover:text-[#0d9488] dark:hover:text-white hover:bg-[#f0fdfa] dark:hover:bg-zinc-800/50 border-l-4 border-transparent`;

  const isAt = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { to: '/', end: true, icon: 'dashboard', label: 'Dashboard' },
    { to: '/team', icon: 'group', label: 'My Team' },
    { to: '/billing', icon: 'payments', label: 'Billing' },
    { to: '/settings/workspace', icon: 'settings', label: 'Settings' },
  ];

  const logoBadge = (
    <div className="w-10 h-10 bg-[#0f766e] rounded flex items-center justify-center shrink-0">
      <span className="material-symbols-outlined text-white" style={{fontVariationSettings:"'FILL' 1"}}>graphic_eq</span>
    </div>
  );

  return (
    <aside
      className="fixed left-0 top-0 h-full bg-white dark:bg-[#0a0f1a] flex flex-col justify-between py-4 border-r border-[#e2e8f0] dark:border-white/5 shadow-sm z-50 transition-[width] duration-200 ease-in-out overflow-x-hidden overflow-y-auto scrollbar-none"
      style={{ width: `${collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH}px` }}
    >
      <div className="flex flex-col gap-4">
        {/* Fixed-height header so the nav list below always starts at the same
            Y position whether collapsed or expanded — otherwise the differing
            header heights make the nav icons jump during the toggle. Both
            states share the same structure now: logo block, then the toggle
            on its own row, then nav — matching the reference. */}
        <div className="h-[92px] flex flex-col justify-center">
          {collapsed ? (
            // border-l-4 (transparent) matches the nav items' active-state accent
            // border below, so both center within the same reduced content width
            // and the hamburger lines up exactly with the nav icons under it.
            <div className="flex flex-col items-center gap-3 border-l-4 border-transparent">
              {logoBadge}
              <button
                onClick={onToggleCollapse}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-[#64748b] dark:text-zinc-400 hover:text-[#0d9488] dark:hover:text-white hover:bg-[#f0fdfa] dark:hover:bg-zinc-800 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488]/40"
              >
                <span className="material-symbols-outlined text-[22px]">menu</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 min-w-0 px-4">
                {logoBadge}
                <div className="min-w-0">
                  <h1 className="font-bold text-[#0f172a] dark:text-white text-base leading-tight truncate">AI Caller Pro</h1>
                  <p className="text-[#64748b] dark:text-zinc-400 text-[11px] uppercase tracking-widest truncate">Enterprise Operations</p>
                </div>
              </div>
              <div className="flex justify-end px-4">
                <button
                  onClick={onToggleCollapse}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg text-[#64748b] dark:text-zinc-400 hover:text-[#0d9488] dark:hover:text-white hover:bg-[#f0fdfa] dark:hover:bg-zinc-800 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488]/40"
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ to, end, icon, label }) => (
            <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined} className={isAt(to) ? activeClass : inactiveClass}>
              <NavIcon>{icon}</NavIcon>
              <NavLabel collapsed={collapsed}>{label}</NavLabel>
            </NavLink>
          ))}

          <RoleGate allow={['SUPER_ADMIN']}>
            <NavLink to="/admin" title={collapsed ? 'Admin Panel' : undefined} className={isAt('/admin') ? activeClass : inactiveClass}>
              <NavIcon>admin_panel_settings</NavIcon>
              <NavLabel collapsed={collapsed}>Admin Panel</NavLabel>
            </NavLink>
          </RoleGate>
          <RoleGate allow={['SUPER_ADMIN', 'ADMIN']}>
            <NavLink to="/docs" title={collapsed ? 'Docs' : undefined} className={isAt('/docs') ? activeClass : inactiveClass}>
              <NavIcon>menu_book</NavIcon>
              <NavLabel collapsed={collapsed}>Docs</NavLabel>
            </NavLink>
          </RoleGate>
        </nav>

        <div className="px-4">
          <button
            onClick={() => navigate('/create-campaign')}
            title={collapsed ? 'New Campaign' : undefined}
            className="w-full bg-[#0d9488] hover:bg-[#0f766e] text-white py-3 rounded-lg text-sm flex items-center transition-all active:scale-95"
          >
            {/* Icon slot is fixed to the collapsed button's own content width
                (76px rail - 16px*2 wrapper padding = 44px), so it's centered
                in the collapsed square AND sits at that exact same X once
                expanded — the label just appears after the slot, so the icon
                never moves between states. */}
            <span className="shrink-0 flex items-center justify-center" style={{ width: '44px' }}>
              <span className="material-symbols-outlined text-[18px]">campaign</span>
            </span>
            <NavLabel collapsed={collapsed}>New Campaign</NavLabel>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1 pt-2">
        {!collapsed && <BalanceWidget />}
        <div className="border-t border-[#e2e8f0] dark:border-zinc-800 pt-2 flex flex-col gap-1">
          <NavLink
            to="/support"
            title={collapsed ? 'Support' : undefined}
            className={({ isActive }) => `flex items-center py-2.5 transition-all text-left w-full text-sm rounded-lg ${isActive ? 'text-[#0d9488] dark:text-white bg-[#f0fdfa] dark:bg-zinc-800/70' : 'text-[#475569] dark:text-zinc-400 hover:text-[#0d9488] dark:hover:text-white hover:bg-[#f0fdfa] dark:hover:bg-zinc-800/50'}`}
          >
            <NavIcon>contact_support</NavIcon>
            <NavLabel collapsed={collapsed}>Support</NavLabel>
          </NavLink>
          {user && (
            <button
              onClick={handleLogout}
              title={collapsed ? 'Sign out' : undefined}
              className="flex items-center py-2.5 text-[#64748b] dark:text-zinc-500 hover:text-[#334155] dark:hover:text-zinc-200 hover:bg-[#f0fdfa] dark:hover:bg-zinc-800 transition-colors text-left w-full text-sm"
            >
              <NavIcon>logout</NavIcon>
              <NavLabel collapsed={collapsed}>Sign out</NavLabel>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

function TopBar({ collapsed }) {
  const { user } = useAuth();
  const location = useLocation();
  const isDocsRoute = location.pathname.startsWith('/docs');
  const initials = user?.name?.charAt(0)?.toUpperCase() || 'U';
  const sidebarWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH;

  return (
    <header
      className="fixed top-0 right-0 bg-[#f8fafc] dark:bg-slate-900 flex justify-between items-center px-8 h-16 z-40 border-b border-[#e2e8f0] dark:border-slate-700 shadow-sm transition-[width] duration-200 ease-in-out"
      style={{ width: isDocsRoute ? '100%' : `calc(100% - ${sidebarWidth}px)` }}
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b] dark:text-slate-400 text-[18px]">search</span>
          <input className="w-full bg-[#f0fdfa] dark:bg-slate-800 border-none rounded-full py-2 pl-10 pr-4 text-sm text-[#0f172a] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0d9488] placeholder:text-[#64748b] dark:placeholder:text-slate-500" placeholder="Search logs, campaigns..." type="text" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <TopBarWorkspacePicker />
        <ThemeToggle />
        <NotificationDropdown />
        <div className="h-8 w-px bg-[#cbd5e1] dark:bg-slate-700 mx-2"></div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden lg:block">
            <p className="text-sm text-[#0f172a] dark:text-slate-100 font-medium leading-tight">{user?.name || 'User'}</p>
            <p className="text-[10px] text-[#64748b] dark:text-slate-400 uppercase tracking-wider">{user?.workspaceRole || user?.role}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-[#0f766e] flex items-center justify-center text-white text-sm font-bold border border-[#cbd5e1] dark:border-slate-600 overflow-hidden shrink-0">
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
  const location = useLocation();
  const isDocsRoute = location.pathname.startsWith('/docs');
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebarCollapsed');
    return stored === null ? true : stored === '1';
  });

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', next ? '1' : '0');
      return next;
    });
  };

  const contentMargin = isDocsRoute ? 0 : (collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc] dark:bg-slate-900">
      {!isDocsRoute && <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />}
      <div className="flex-1 flex flex-col overflow-hidden transition-[margin] duration-200 ease-in-out" style={{ marginLeft: `${contentMargin}px` }}>
        <TopBar collapsed={collapsed} />
        <main className="flex-1 overflow-y-auto pt-16">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create-campaign" element={
              <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']} fallback={<div className="flex items-center justify-center h-64 text-[#334155] dark:text-slate-400 text-sm">You don't have permission to create campaigns.</div>}>
                <CampaignWizard />
              </RoleGate>
            } />
            <Route path="/edit-campaign/:id" element={
              <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']} fallback={<div className="flex items-center justify-center h-64 text-[#334155] dark:text-slate-400 text-sm">You don't have permission to edit campaigns.</div>}>
                <CampaignWizard />
              </RoleGate>
            } />
            <Route path="/admin" element={
              <RoleGate allow={['SUPER_ADMIN']} fallback={<div className="flex items-center justify-center h-64 text-[#334155] dark:text-slate-400 text-sm">You don't have permission to access the admin panel.</div>}>
                <AdminDashboard />
              </RoleGate>
            } />
            <Route path="/campaigns/:id" element={<CampaignDetails />} />
            <Route path="/campaigns/:id/report" element={<CampaignReport />} />
            <Route path="/campaign/:campaignId/calls/:id" element={<CallDetails />} />
            <Route path="/campaign/:campaignId/calls/:id/report" element={<CallReport />} />
            <Route path="/docs" element={
              <RoleGate allow={['SUPER_ADMIN', 'ADMIN']} fallback={<div className="flex items-center justify-center h-64 text-[#334155] dark:text-slate-400 text-sm">You don't have permission to view documentation.</div>}>
                <Docs />
              </RoleGate>
            } />
            <Route path="/docs/:slug" element={
              <RoleGate allow={['SUPER_ADMIN', 'ADMIN']} fallback={<div className="flex items-center justify-center h-64 text-[#334155] dark:text-slate-400 text-sm">You don't have permission to view documentation.</div>}>
                <Docs />
              </RoleGate>
            } />
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

function RootRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] dark:bg-slate-900">
        <div className="w-12 h-12 bg-[#0f766e] rounded-xl flex items-center justify-center shadow-lg">
          <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>graphic_eq</span>
        </div>
      </div>
    );
  }

  return user ? <AppLayout /> : <Landing />;
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
                <Route path="/" element={<RootRoute />} />
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
