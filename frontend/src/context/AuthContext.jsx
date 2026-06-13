import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import api from '../api/axios';

const AuthContext = createContext(null);

const BASE = () => import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const tryRefresh = async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      const storedUser = localStorage.getItem('user');
      const storedWorkspaces = localStorage.getItem('workspaces');

      if (!refreshToken || !storedUser) { setIsLoading(false); return; }

      try {
        const u = JSON.parse(storedUser);
        const { data } = await axios.post(`${BASE()}/api/auth/refresh`, { refreshToken, workspaceId: u.workspaceId });
        localStorage.setItem('accessToken', data.accessToken);
        const ws = storedWorkspaces ? JSON.parse(storedWorkspaces) : [];
        setUser(u);
        setWorkspaces(ws);

        // Always fetch fresh workspaces on load to detect stale membership
        try {
          const { data: wsData } = await api.get('/api/workspaces');
          setWorkspaces(wsData);
          localStorage.setItem('workspaces', JSON.stringify(wsData));

          // If stored workspaceId is no longer valid, switch to first available
          const stillValid = wsData.find(w => w.id === u.workspaceId);
          if (!stillValid && wsData.length > 0) {
            const { data: sw } = await api.post('/api/auth/switch-workspace', { workspaceId: wsData[0].id });
            localStorage.setItem('accessToken', sw.accessToken);
            localStorage.setItem('refreshToken', sw.refreshToken);
            localStorage.setItem('user', JSON.stringify(sw.user));
            setUser(sw.user);
          }
        } catch { /* ignore */ }
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('workspaces');
      } finally {
        setIsLoading(false);
      }
    };
    tryRefresh();
  }, []);

  const _persist = (accessToken, refreshToken, userData, workspacesData = []) => {
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('workspaces', JSON.stringify(workspacesData));
    setUser(userData);
    setWorkspaces(workspacesData);
  };

  const login = async (email, password) => {
    const { data } = await axios.post(`${BASE()}/api/auth/login`, { email, password });
    _persist(data.accessToken, data.refreshToken, data.user, data.workspaces || []);
    return data;
  };

  const loginWithTokens = (accessToken, refreshToken, userData, workspacesData = []) => {
    _persist(accessToken, refreshToken, userData, workspacesData);
  };

  const switchWorkspace = async (workspaceId) => {
    const { data } = await api.post('/api/auth/switch-workspace', { workspaceId });
    // Keep existing workspaces list, just update token + user
    _persist(data.accessToken, data.refreshToken, data.user, workspaces);
    return data;
  };

  const refreshWorkspaces = async () => {
    try {
      const { data } = await api.get('/api/workspaces');
      setWorkspaces(data);
      localStorage.setItem('workspaces', JSON.stringify(data));

      // If current workspaceId is no longer valid (e.g. membership removed), switch to first available
      const storedUser = localStorage.getItem('user');
      if (storedUser && data.length > 0) {
        const u = JSON.parse(storedUser);
        const stillValid = data.find(w => w.id === u.workspaceId);
        if (!stillValid) {
          try {
            await api.post('/api/auth/switch-workspace', { workspaceId: data[0].id }).then(({ data: sw }) => {
              localStorage.setItem('accessToken', sw.accessToken);
              localStorage.setItem('refreshToken', sw.refreshToken);
              localStorage.setItem('user', JSON.stringify(sw.user));
              setUser(sw.user);
            });
          } catch { /* best-effort */ }
        }
      }

      return data;
    } catch { return []; }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try { await axios.post(`${BASE()}/api/auth/logout`, { refreshToken }); } catch {}
    ['accessToken', 'refreshToken', 'user', 'workspaces'].forEach(k => localStorage.removeItem(k));
    setUser(null);
    setWorkspaces([]);
  };

  const refreshUser = async () => {
    try {
      const { data } = await api.get('/api/auth/me');
      const updated = { ...user, name: data.name, avatarUrl: data.avatarUrl };
      setUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, workspaces, isLoading, login, loginWithTokens, switchWorkspace, refreshWorkspaces, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
