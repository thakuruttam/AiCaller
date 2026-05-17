import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { PhoneCall, Activity, PlusCircle, LogOut, ChevronDown, Shield } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
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
import './index.css';

const ROLE_COLORS = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-blue-100 text-blue-700',
  EDITOR: 'bg-green-100 text-green-700',
  VIEWER: 'bg-gray-100 text-gray-600',
};

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const effectiveRole = user?.workspaceRole || user?.role;
  const roleColor = ROLE_COLORS[effectiveRole] || ROLE_COLORS.VIEWER;

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col p-4 h-full overflow-y-auto">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-8 mt-2">
        <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center">
          <PhoneCall size={18} />
        </div>
        <h1 className="text-xl font-bold tracking-tight">AI Caller</h1>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-2 flex-1">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-secondary text-secondary-foreground font-medium' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`
          }
        >
          <Activity size={18} />
          <span>Dashboard</span>
        </NavLink>

        <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']}>
          <NavLink
            to="/create-campaign"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-secondary text-secondary-foreground font-medium' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`
            }
          >
            <PlusCircle size={18} />
            <span>New Campaign</span>
          </NavLink>
        </RoleGate>

        <RoleGate allow={['SUPER_ADMIN', 'ADMIN']}>
          <NavLink
            to="/admin"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-secondary text-secondary-foreground font-medium' : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}`
            }
          >
            <Shield size={18} />
            <span>Admin Panel</span>
          </NavLink>
        </RoleGate>
      </nav>

      {/* User info */}
      {user && (
        <div className="border-t border-border pt-4 mt-4">
          {/* Workspace */}
          {user.workspaceName && (
            <div className="px-2 mb-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Workspace</p>
              <p className="text-sm font-medium truncate">{user.workspaceName}</p>
            </div>
          )}

          {/* User row */}
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-secondary/50 transition-colors">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>

          {/* Role badge */}
          <div className="px-2 mt-2 mb-3">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${roleColor}`}>
              <Shield size={10} />
              {effectiveRole?.replace('_', ' ')}
            </span>
          </div>

          {/* Logout */}
          <button
            id="logout-btn"
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-md transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}

function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground antialiased font-sans">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8 lg:p-12 xl:p-16 max-w-[1400px] mx-auto w-full">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/create-campaign" element={
            <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']} fallback={<div className="text-muted-foreground">You don't have permission to create campaigns.</div>}>
              <CampaignWizard />
            </RoleGate>
          } />
          <Route path="/edit-campaign/:id" element={
            <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']} fallback={<div className="text-muted-foreground">You don't have permission to edit campaigns.</div>}>
              <CampaignWizard />
            </RoleGate>
          } />
          <Route path="/admin" element={
            <RoleGate allow={['SUPER_ADMIN', 'ADMIN']} fallback={<div className="text-muted-foreground">You don't have permission to access the admin panel.</div>}>
              <AdminDashboard />
            </RoleGate>
          } />
          <Route path="/campaigns/:id" element={<CampaignDetails />} />
          <Route path="/campaigns/:id/report" element={<CampaignReport />} />
          <Route path="/campaign/:campaignId/calls/:id" element={<CallDetails />} />
          <Route path="/campaign/:campaignId/calls/:id/report" element={<CallReport />} />
        </Routes>
      </main>
    </div>
  );
}

import { ToastProvider } from './context/ToastContext';

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
