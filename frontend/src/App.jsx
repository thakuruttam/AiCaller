import React, { useState, useEffect } from 'react';
import { Button, IconButton } from './components/ui';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import api from './api/axios';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
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
import Web3Dashboard from './pages/web3-dashboard';
import { ToastProvider } from './context/ToastContext';
import { NotificationProvider } from './context/NotificationContext';
import NotificationDropdown from './components/NotificationDropdown';
import {
  SidebarProvider,
  SidebarInset,
} from './pages/web3-dashboard/ui/sidebar';
import { DashboardSidebar } from './pages/web3-dashboard/components/web3/sidebar';
import { DashboardTopbar } from './pages/web3-dashboard/components/web3/topbar';
import { PortalContainerProvider } from './pages/web3-dashboard/ui/portal-container';
import './pages/web3-dashboard/dashboard.css';
import './index.css';


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

// SidebarProvider persists expand/collapse to a cookie but only ever writes
// it — reading it back on mount is normally done server-side in Next.js. We
// have no server, so read it ourselves here; otherwise every remount (e.g.
// "/" -> any other path crosses a <Route> boundary in App()) snaps back to
// defaultOpen instead of what the user last chose.
function getStoredSidebarOpen() {
  if (typeof document === 'undefined') return false;
  const match = document.cookie.match(/(?:^|;\s*)sidebar_state=(true|false)/);
  return match ? match[1] === 'true' : false;
}

function AppLayout() {
  return (
    <SidebarProvider
      defaultOpen={getStoredSidebarOpen()}
      className="web3-dashboard flex h-screen overflow-hidden bg-paper-300 dark:bg-ink-50"
      style={{
        '--sidebar-width': 'calc(var(--spacing) * 64)',
        '--sidebar-width-icon': 'calc(var(--spacing) * 14)',
      }}
    >
      <PortalContainerProvider>
        <DashboardSidebar />
        <SidebarInset className="bg-paper-300 dark:bg-ink-50 overflow-y-auto">
          <div className="px-4 lg:px-8">
            <DashboardTopbar />
          </div>
          <main className="flex-1">
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
        </SidebarInset>
      </PortalContainerProvider>
    </SidebarProvider>
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
                <Route path="/dashboard/web3-dashboard" element={<Web3Dashboard />} />
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
