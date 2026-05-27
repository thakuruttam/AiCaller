import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
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
import { ToastProvider } from './context/ToastContext';
import './index.css';

function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navItemBase = 'flex items-center gap-3 px-4 py-3 transition-all text-sm font-mono';
  const activeClass = `${navItemBase} text-white bg-zinc-800 border-l-4 border-[#3525cd]`;
  const inactiveClass = `${navItemBase} text-zinc-400 hover:text-white hover:bg-zinc-800/50 border-l-4 border-transparent`;

  const isAt = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-[280px] bg-[#0f172a] flex flex-col justify-between py-6 border-r border-white/5 shadow-sm z-50">
      <div className="flex flex-col gap-8">
        <div className="px-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#4f46e5] rounded flex items-center justify-center">
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
          <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']}>
            <NavLink to="/create-campaign" className={isAt('/create-campaign') || isAt('/edit-campaign') ? activeClass : inactiveClass}>
              <span className="material-symbols-outlined text-[20px]">campaign</span>
              <span>New Campaign</span>
            </NavLink>
          </RoleGate>
          <RoleGate allow={['SUPER_ADMIN', 'ADMIN']}>
            <NavLink to="/admin" className={isAt('/admin') ? activeClass : inactiveClass}>
              <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
              <span>Admin Panel</span>
            </NavLink>
          </RoleGate>
        </nav>

        <div className="px-4">
          <button className="w-full bg-[#3525cd] hover:bg-[#4f46e5] text-white py-3 rounded-lg text-sm flex items-center justify-center gap-2 transition-all active:scale-95" style={{fontFamily:'JetBrains Mono, monospace'}}>
            <span className="material-symbols-outlined text-[18px]">add_call</span>
            New Call
          </button>
        </div>
      </div>

      <div className="flex flex-col border-t border-zinc-800 pt-6">
        <button className="flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all text-left w-full text-sm" style={{fontFamily:'JetBrains Mono, monospace'}}>
          <span className="material-symbols-outlined text-[20px]">settings</span>
          Settings
        </button>
        <button className="flex items-center gap-3 px-4 py-3 text-zinc-400 hover:text-white hover:bg-zinc-800/50 transition-all text-left w-full text-sm" style={{fontFamily:'JetBrains Mono, monospace'}}>
          <span className="material-symbols-outlined text-[20px]">contact_support</span>
          Support
        </button>
        {user && (
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors text-left w-full text-sm" style={{fontFamily:'JetBrains Mono, monospace'}}>
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Sign out
          </button>
        )}
      </div>
    </aside>
  );
}

function TopBar() {
  const { user } = useAuth();
  const initials = user?.name?.charAt(0)?.toUpperCase() || 'U';

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-280px)] bg-[#fcf8ff] flex justify-between items-center px-8 h-16 z-40 border-b border-[#e4e1ee] shadow-sm">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#777587] text-[18px]">search</span>
          <input className="w-full bg-[#f5f2ff] border-none rounded-full py-2 pl-10 pr-4 text-sm text-[#1b1b24] focus:outline-none focus:ring-2 focus:ring-[#3525cd] placeholder:text-[#777587]" placeholder="Search logs, campaigns..." type="text" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="p-2 hover:bg-[#f0ecf9] rounded-full text-[#464555] transition-colors relative">
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-[#ba1a1a] rounded-full border-2 border-[#fcf8ff]"></span>
        </button>
        <button className="p-2 hover:bg-[#f0ecf9] rounded-full text-[#464555] transition-colors">
          <span className="material-symbols-outlined text-[20px]">help_outline</span>
        </button>
        <div className="h-8 w-px bg-[#c7c4d8] mx-2"></div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#1b1b24] hidden lg:block" style={{fontFamily:'JetBrains Mono, monospace'}}>{user?.name || 'User'}</span>
          <div className="w-9 h-9 rounded-full bg-[#4f46e5] flex items-center justify-center text-white text-sm font-bold border border-[#c7c4d8]">{initials}</div>
        </div>
      </div>
    </header>
  );
}

function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#fcf8ff]">
      <Sidebar />
      <div className="ml-[280px] flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto pt-16">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create-campaign" element={
              <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']} fallback={<div className="flex items-center justify-center h-64 text-[#464555] text-sm">You don't have permission to create campaigns.</div>}>
                <CampaignWizard />
              </RoleGate>
            } />
            <Route path="/edit-campaign/:id" element={
              <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']} fallback={<div className="flex items-center justify-center h-64 text-[#464555] text-sm">You don't have permission to edit campaigns.</div>}>
                <CampaignWizard />
              </RoleGate>
            } />
            <Route path="/admin" element={
              <RoleGate allow={['SUPER_ADMIN', 'ADMIN']} fallback={<div className="flex items-center justify-center h-64 text-[#464555] text-sm">You don't have permission to access the admin panel.</div>}>
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
