import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import {
  PhoneCall, Activity, PlusCircle, LogOut, Shield,
  BarChart3, Settings, Sun, Moon
} from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
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
import { ToastProvider } from './context/ToastContext';
import './index.css';

const navLinkClass = ({ isActive }) =>
  `group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
    isActive
      ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-inset ring-white/10'
      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
  }`;

const ROLE_LABELS = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
};

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
    >
      {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  );
}

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const effectiveRole = user?.workspaceRole || user?.role;
  const initials = user?.name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <aside className="w-64 shrink-0 flex flex-col bg-slate-900 h-full">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800/60">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-900/40">
          <PhoneCall size={15} className="text-white" />
        </div>
        <span className="text-white font-semibold text-[15px] tracking-tight">AI Caller</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <NavLink to="/" end className={navLinkClass}>
          <Activity size={16} />
          <span>Dashboard</span>
        </NavLink>

        <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']}>
          <NavLink to="/create-campaign" className={navLinkClass}>
            <PlusCircle size={16} />
            <span>New Campaign</span>
          </NavLink>
        </RoleGate>

        <RoleGate allow={['SUPER_ADMIN', 'ADMIN']}>
          <div className="mx-3 my-3 border-t border-slate-800/70" />
          <NavLink to="/admin" className={navLinkClass}>
            <Shield size={16} />
            <span>Admin Panel</span>
          </NavLink>
        </RoleGate>
      </nav>

      {/* User footer */}
      {user && (
        <div className="border-t border-slate-800/60 p-3">
          {user.workspaceName && (
            <p className="px-3 pb-1 text-[10px] font-semibold text-slate-600 uppercase tracking-widest truncate">
              {user.workspaceName}
            </p>
          )}
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
            <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate leading-tight">{user.name}</p>
              <p className="text-[11px] text-slate-500 truncate mt-0.5">{user.email}</p>
            </div>
          </div>
          {effectiveRole && (
            <div className="px-3 pb-1">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                <Shield size={9} />
                {ROLE_LABELS[effectiveRole] || effectiveRole}
              </span>
            </div>
          )}
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 mt-0.5 rounded-lg text-sm text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </aside>
  );
}

function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-6 py-8 h-full flex flex-col">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create-campaign" element={
              <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']} fallback={
                <div className="flex items-center justify-center h-64 text-zinc-500 dark:text-slate-400 text-sm">
                  You don't have permission to create campaigns.
                </div>
              }>
                <CampaignWizard />
              </RoleGate>
            } />
            <Route path="/edit-campaign/:id" element={
              <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']} fallback={
                <div className="flex items-center justify-center h-64 text-zinc-500 dark:text-slate-400 text-sm">
                  You don't have permission to edit campaigns.
                </div>
              }>
                <CampaignWizard />
              </RoleGate>
            } />
            <Route path="/admin" element={
              <RoleGate allow={['SUPER_ADMIN', 'ADMIN']} fallback={
                <div className="flex items-center justify-center h-64 text-zinc-500 dark:text-slate-400 text-sm">
                  You don't have permission to access the admin panel.
                </div>
              }>
                <AdminDashboard />
              </RoleGate>
            } />
            <Route path="/campaigns/:id" element={<CampaignDetails />} />
            <Route path="/campaigns/:id/report" element={<CampaignReport />} />
            <Route path="/campaign/:campaignId/calls/:id" element={<CallDetails />} />
            <Route path="/campaign/:campaignId/calls/:id/report" element={<CallReport />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/*" element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              } />
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
