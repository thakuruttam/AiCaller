import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // On app mount — attempt silent refresh
  useEffect(() => {
    const tryRefresh = async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      const storedUser = localStorage.getItem('user');

      if (!refreshToken || !storedUser) {
        setIsLoading(false);
        return;
      }

      try {
        const { data } = await axios.post('http://localhost:3000/api/auth/refresh', { refreshToken });
        localStorage.setItem('accessToken', data.accessToken);
        setUser(JSON.parse(storedUser));
      } catch {
        // Refresh failed — clear storage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      } finally {
        setIsLoading(false);
      }
    };

    tryRefresh();
  }, []);

  const login = async (email, password) => {
    const { data } = await axios.post('http://localhost:3000/api/auth/login', { email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    setWorkspaces(data.workspaces || []);
    return data;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      await axios.post('http://localhost:3000/api/auth/logout', { refreshToken });
    } catch {}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    setWorkspaces([]);
  };

  return (
    <AuthContext.Provider value={{ user, workspaces, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
