import React, { useState, useRef, useEffect } from 'react';
import { Button, IconButton } from './components/ui';
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import api from './api/axios';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import RoleGate from './components/RoleGate';
import Landing from './pages/marketing';
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
import NotFound from './pages/NotFound';
import Usage from './pages/Usage';
import Notifications from './pages/Notifications';
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
      <Button variant="secondary" size="sm" onClick={() => setOpen(o => !o)}>
        <div className="w-5 h-5 rounded-field bg-brand-500 flex items-center justify-center shrink-0 text-[10px] font-semibold text-white">
          {initials}
        </div>
        <span className="max-w-[110px] truncate text-[12.5px] font-medium text-ink-100 dark:text-paper-200">
          {current?.name || 'No Workspace'}
        </span>
        <span className={`material-symbols-outlined [--icon-size:14px] text-ink-700 transition-transform ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </Button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute top-[calc(100%+8px)] right-0 w-64 bg-paper-100 dark:bg-ink-200 rounded-card shadow-raised border border-paper-500 dark:border-ink-400 z-50 overflow-hidden">

          {/* Current workspace header — clean, no gradient */}
          <div className="px-4 py-3.5 border-b border-paper-400 dark:border-ink-400">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-chip bg-brand-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-ink-100 dark:text-paper-200 truncate leading-snug">
                  {current?.name || 'No Workspace'}
                </p>
                <p className="text-[11px] text-brand-600 dark:text-brand-300 font-medium capitalize leading-none mt-0.5">
                  {(current?.role || user?.workspaceRole || user?.role || '').toLowerCase()}
                </p>
              </div>
              <span className="w-2 h-2 rounded-full bg-positive shrink-0" title="Active" />
            </div>
          </div>

          {/* Workspace list */}
          {workspaces.length > 1 && (
            <div className="py-1">
              <p className="px-4 pt-2 pb-1.5 text-[11px] font-medium text-ink-700 dark:text-ink-800">
                Switch workspace
              </p>
              <div className="max-h-40 overflow-y-auto">
                {workspaces.filter(w => w.id !== user?.workspaceId).map(w => (
                  <Button variant="ghost" size="md" key={w.id} onClick={() => handleSwitch(w.id)} disabled={!!switching}>
                    <div className="w-7 h-7 rounded-field bg-brand-100 dark:bg-brand-500/15 flex items-center justify-center shrink-0 text-xs font-semibold text-brand-600 dark:text-brand-300 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                      {switching === w.id
                        ? <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                        : w.name.charAt(0).toUpperCase()}
                    </div>
                    <p className="flex-1 text-[13px] font-medium text-ink-600 dark:text-ink-900 truncate group-hover:text-ink-100 dark:group-hover:text-white transition-colors">
                      {w.name}
                    </p>
                    <span className="material-symbols-outlined [--icon-size:14px] text-paper-900 dark:text-ink-600 group-hover:text-brand-500 transition-colors">
                      chevron_right
                    </span>
                  </Button>
                ))}
              </div>
              <div className="mx-4 border-t border-paper-400 dark:border-ink-400" />
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
                  className="w-full h-8 px-3 bg-paper-300 dark:bg-ink-300 border border-paper-500 dark:border-ink-400 rounded-control text-sm text-ink-100 dark:text-paper-200 placeholder:text-ink-700 focus:outline-none focus:ring-[3px] focus:ring-brand-500/25 focus:border-brand-500 transition-shadow"
                />
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" type="submit" disabled={creating || !newWsName.trim()}>
                    {creating
                      ? <span className="material-symbols-outlined text-[13px] animate-spin">progress_activity</span>
                      : <><span className="material-symbols-outlined text-[13px]">add</span>Create</>}
                  </Button>
                  <Button variant="secondary" size="sm" type="button" onClick={() => { setShowCreate(false); setNewWsName(''); }}>Cancel</Button>
                </div>
              </form>
            ) : (
              <Button variant="ghost" size="md" icon="add_circle" onClick={() => setShowCreate(true)}>New workspace</Button>
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

  const borderColor = isDepleted ? 'border-negative/40' : isLow ? 'border-caution/40' : 'border-paper-500 dark:border-ink-400';
  const bgColor     = isDepleted ? 'bg-negative/10'          : isLow ? 'bg-caution/10'          : 'bg-paper-200 dark:bg-ink-300/60';
  const numColor    = isDepleted ? 'text-negative-dim'        : isLow ? 'text-caution-dim'        : 'text-ink-100 dark:text-white';

  return (
    <div className={`mx-3 mb-2 rounded-control border overflow-hidden ${bgColor} ${borderColor}`}>
      {/* Balance row → goes to /billing */}
      <NavLink to="/billing" className="block px-3 pt-2.5 pb-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-ink-700 dark:text-ink-800">Balance</span>
          {isDepleted && <span className="text-[10px] font-bold text-negative-dim dark:text-negative">TOP UP</span>}
          {isLow && !isDepleted && <span className="text-[10px] font-bold text-caution-dim dark:text-caution">LOW</span>}
        </div>
        <div className="flex items-end gap-1.5">
          <span className={`text-lg font-bold leading-none ${numColor}`}>
            {balance.minuteBalance.toLocaleString('en-IN')}
          </span>
          <span className="text-xs text-ink-700 dark:text-ink-800 mb-0.5">min</span>
        </div>
      </NavLink>

      {/* Usage row → goes to /usage */}
      <NavLink
        to="/usage"
        className="flex items-center justify-between px-3 py-1.5 border-t border-paper-500 dark:border-ink-400 hover:bg-paper-300 dark:hover:bg-white/5 transition-colors"
      >
        <span className="text-[11px] font-medium text-ink-700 dark:text-ink-800">Usage</span>
        <span className="material-symbols-outlined [--icon-size:14px] text-ink-800">arrow_forward</span>
      </NavLink>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <IconButton tone="neutral" size="md" title={isDark ? 'Switch to light mode' : 'Switch to dark mode'} icon={isDark ? 'light_mode' : 'dark_mode'} onClick={toggleTheme} />
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
// Nav row geometry. The active state is an inset rounded pill rather than a
// left border: a border pushes the row's content sideways, which meant every
// row had to carry a matching transparent one just to stay aligned (the
// Support row didn't, and sat 4px off). With a pill there is nothing to
// compensate for, and the icon can sit at the same X in both states.
//
//   rail collapsed = 76  ->  item inset 8 each side, 60 wide, icon centred at 38
//   rail expanded  = 280 ->  item inset 8, pl-5 (20), icon box 20 -> centre 38
const NAV_ICON_BOX = 20;

const NavIcon = ({ children }) => (
  <span
    className="shrink-0 flex items-center justify-center"
    style={{ width: `${NAV_ICON_BOX}px`, height: `${NAV_ICON_BOX}px` }}
  >
    <span className="material-symbols-outlined [--icon-size:20px]">{children}</span>
  </span>
);

// Always mounted (never conditionally rendered) so the label fades and
// collapses its own width in step with the sidebar's width transition rather
// than popping in and out in a single frame.
const NavLabel = ({ collapsed, children }) => (
  <span
    className={`whitespace-nowrap overflow-hidden transition-all duration-200 ease-in-out ${
      collapsed ? 'opacity-0 max-w-0 ml-0' : 'opacity-100 max-w-[170px] ml-3'
    }`}
  >
    {children}
  </span>
);

// Group heading above a run of nav items. It collapses its own height (not
// just opacity) on the rail so the icons below don't drift. The 60px inset is
// where the row labels start: item inset 8 + pl-5 (20) + icon 20 + ml-3 (12).
const NavSection = ({ collapsed, children }) => (
  <p
    aria-hidden={collapsed}
    style={{ paddingLeft: collapsed ? 0 : 60 }}
    className={`text-[11px] font-medium text-ink-800 whitespace-nowrap overflow-hidden transition-all duration-200 ease-in-out ${
      collapsed ? 'opacity-0 max-h-0 py-0' : 'opacity-100 max-h-10 pt-5 pb-1.5'
    }`}
  >
    {children}
  </p>
);

// One row shape for every sidebar destination — links, the support entry and
// the sign-out button all render through this, so they cannot drift apart.
const navRowClass = (collapsed, active) => [
  'group relative flex items-center h-11 mx-2 rounded-control text-sm',
  'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
  collapsed ? 'justify-center px-0' : 'pl-5 pr-3',
  active
    ? 'font-medium bg-brand-100 text-brand-600 dark:bg-ink-300 dark:text-white'
    : 'text-ink-600 dark:text-ink-900 hover:bg-paper-300 dark:hover:bg-ink-300/60 hover:text-ink-100 dark:hover:text-white',
].join(' ');

function Sidebar({ collapsed, onToggleCollapse, mobile = false, onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isAt = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { to: '/', end: true, icon: 'dashboard', label: 'Dashboard' },
  ];

  const workspaceItems = [
    { to: '/notifications', icon: 'notifications', label: 'Notifications' },
    { to: '/team', icon: 'group', label: 'My Team' },
    { to: '/billing', icon: 'payments', label: 'Billing' },
    { to: '/settings/workspace', icon: 'settings', label: 'Settings' },
  ];

  const logoBadge = (
    <div className="w-10 h-10 bg-brand-500 rounded-chip flex items-center justify-center shrink-0">
      <span className="material-symbols-outlined text-white" style={{fontVariationSettings:"'FILL' 1"}}>graphic_eq</span>
    </div>
  );

  return (
    <aside
      // On the drawer, any click that lands on a link has navigated — dismiss
      // it there rather than reacting to the route change afterwards.
      onClick={mobile ? (e) => { if (e.target.closest('a')) onNavigate?.(); } : undefined}
      className={`fixed left-0 top-0 h-full bg-paper-100 dark:bg-ink-100 flex flex-col justify-between py-6 border-r border-paper-500 dark:border-ink-400 z-50 overflow-x-hidden overflow-y-auto scrollbar-none ${
        mobile ? 'animate-slide-in-left shadow-overlay' : 'transition-[width] duration-200 ease-in-out'
      }`}
      style={{ width: `${collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH}px` }}
    >
      <div className="flex flex-col gap-6">
        {/* Fixed-height header so the nav list below always starts at the same
            Y position whether collapsed or expanded — otherwise the differing
            header heights make the nav icons jump during the toggle. Both
            states share the same structure now: logo block, then the toggle
            on its own row, then nav — matching the reference. */}
        <div className="h-[92px] flex flex-col justify-center">
          {collapsed ? (
            <div className="flex flex-col items-center gap-3">
              {logoBadge}
              <IconButton tone="neutral" size="md" title="Expand sidebar" icon="menu" onClick={onToggleCollapse} />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3 min-w-0 px-4">
                {logoBadge}
                <div className="min-w-0">
                  <h1 className="font-semibold text-ink-100 dark:text-white text-base leading-tight truncate">AI Caller Pro</h1>
                  <p className="text-ink-700 dark:text-ink-800 text-[11px] truncate">Enterprise Operations</p>
                </div>
              </div>
              <div className="flex justify-end px-4">
                <IconButton tone="neutral" size="md" title="Collapse sidebar" icon="chevron_left" onClick={onToggleCollapse} />
              </div>
            </div>
          )}
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ to, end, icon, label }) => (
            <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined} className={navRowClass(collapsed, isAt(to))}>
              <NavIcon>{icon}</NavIcon>
              <NavLabel collapsed={collapsed}>{label}</NavLabel>
            </NavLink>
          ))}

          <NavSection collapsed={collapsed}>Workspace</NavSection>
          {workspaceItems.map(({ to, end, icon, label }) => (
            <NavLink key={to} to={to} end={end} title={collapsed ? label : undefined} className={navRowClass(collapsed, isAt(to))}>
              <NavIcon>{icon}</NavIcon>
              <NavLabel collapsed={collapsed}>{label}</NavLabel>
            </NavLink>
          ))}

          <RoleGate allow={['SUPER_ADMIN']}>
            <NavSection collapsed={collapsed}>Administration</NavSection>
            <NavLink to="/admin" title={collapsed ? 'Admin Panel' : undefined} className={navRowClass(collapsed, isAt('/admin'))}>
              <NavIcon>admin_panel_settings</NavIcon>
              <NavLabel collapsed={collapsed}>Admin Panel</NavLabel>
            </NavLink>
          </RoleGate>
        </nav>

        <div className={collapsed ? 'flex justify-center' : 'px-3'}>
          <Button
            variant="primary"
            size="lg"
            fullWidth={!collapsed}
            icon="campaign"
            onClick={() => navigate('/create-campaign')}
            title={collapsed ? 'New Campaign' : undefined}
            aria-label="New Campaign"
            className={collapsed ? '!w-11 !h-11 !px-0' : ''}
          >
            {!collapsed && 'New Campaign'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1 pt-2">
        {!collapsed && <BalanceWidget />}
        <div className="border-t border-paper-500 dark:border-ink-400 pt-2 flex flex-col gap-1">
          <NavLink
            to="/support"
            title={collapsed ? 'Support' : undefined}
            className={({ isActive }) => navRowClass(collapsed, isActive)}
          >
            <NavIcon>contact_support</NavIcon>
            <NavLabel collapsed={collapsed}>Support</NavLabel>
          </NavLink>
          {user && (
            <button
              onClick={handleLogout}
              title={collapsed ? 'Sign out' : undefined}
              className={`${navRowClass(collapsed, false)} w-[calc(100%-1rem)]`}
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

function TopBar({ collapsed, isMobile = false, onOpenMenu }) {
  const { user } = useAuth();
  const initials = user?.name?.charAt(0)?.toUpperCase() || 'U';
  const sidebarWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH;

  return (
    <header
      className="fixed top-0 right-0 bg-paper-100 dark:bg-ink-100 flex justify-between items-center gap-3 px-4 md:px-10 h-16 z-40 border-b border-paper-500 dark:border-ink-400 transition-[width] duration-200 ease-in-out"
      style={{ width: isMobile ? '100%' : `calc(100% - ${sidebarWidth}px)` }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {isMobile && (
          <button
            onClick={onOpenMenu}
            aria-label="Open navigation menu"
            className="shrink-0 p-2 -ml-1 rounded-control text-ink-700 dark:text-ink-900 hover:bg-paper-300 dark:hover:bg-ink-300 transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <span className="material-symbols-outlined [--icon-size:22px]">menu</span>
          </button>
        )}
        <div className="relative w-full max-w-lg">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-ink-700 dark:text-ink-800 [--icon-size:18px]">search</span>
          <input className="w-full bg-paper-300 dark:bg-ink-300 border border-paper-500 dark:border-ink-400 rounded-control py-2 pl-10 pr-4 text-sm text-ink-100 dark:text-paper-200 focus:outline-none focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/25 placeholder:text-ink-700 transition-shadow" placeholder="Search…" type="text" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <TopBarWorkspacePicker />
        <ThemeToggle />
        <NotificationDropdown />
        <div className="h-6 w-px bg-paper-600 dark:bg-ink-400 mx-2"></div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden lg:block">
            <p className="text-sm text-ink-100 dark:text-paper-200 font-medium leading-tight">{user?.name || 'User'}</p>
            <p className="text-[11px] text-ink-700 dark:text-ink-800 capitalize">{(user?.workspaceRole || user?.role || '').toLowerCase()}</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-brand-500 flex items-center justify-center text-white text-sm font-semibold overflow-hidden shrink-0">
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              : initials}
          </div>
        </div>
      </div>
    </header>
  );
}

const MOBILE_BREAKPOINT = 768;

function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebarCollapsed');
    return stored === null ? true : stored === '1';
  });

  // Below md the sidebar is an off-canvas drawer rather than a permanent rail:
  // at 280px fixed it consumed two thirds of a phone screen and pushed the
  // content (including the primary action) off the right edge.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Esc closes it, and the page behind must not scroll while it is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setDrawerOpen(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const toggleCollapse = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', next ? '1' : '0');
      return next;
    });
  };

  const contentMargin = isMobile ? 0 : (collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH);

  return (
    <div className="flex h-screen overflow-hidden bg-paper-300 dark:bg-ink-50">
      {isMobile && drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-50/50 backdrop-blur-[2px] animate-backdrop md:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {(!isMobile || drawerOpen) && (
        <Sidebar
          collapsed={isMobile ? false : collapsed}
          onToggleCollapse={isMobile ? () => setDrawerOpen(false) : toggleCollapse}
          mobile={isMobile}
          onNavigate={() => setDrawerOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden transition-[margin] duration-200 ease-in-out" style={{ marginLeft: `${contentMargin}px` }}>
        <TopBar collapsed={collapsed} isMobile={isMobile} onOpenMenu={() => setDrawerOpen(true)} />
        <main className="flex-1 overflow-y-auto pt-16">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create-campaign" element={
              <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']} fallback={<div className="flex items-center justify-center h-64 text-ink-600 dark:text-ink-900 text-sm">You don't have permission to create campaigns.</div>}>
                <CampaignWizard />
              </RoleGate>
            } />
            <Route path="/edit-campaign/:id" element={
              <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']} fallback={<div className="flex items-center justify-center h-64 text-ink-600 dark:text-ink-900 text-sm">You don't have permission to edit campaigns.</div>}>
                <CampaignWizard />
              </RoleGate>
            } />
            <Route path="/admin" element={
              <RoleGate allow={['SUPER_ADMIN']} fallback={<div className="flex items-center justify-center h-64 text-ink-600 dark:text-ink-900 text-sm">You don't have permission to access the admin panel.</div>}>
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
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/support" element={<Support />} />
            <Route path="*" element={<NotFound />} />
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
      <div className="flex items-center justify-center min-h-screen bg-paper-300 dark:bg-ink-50">
        <div className="w-12 h-12 bg-brand-500 rounded-chip flex items-center justify-center shadow-card">
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
