import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

const POLL_INTERVAL = 30_000;

function getToken() {
  return localStorage.getItem('accessToken');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`
  };
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!user || !getToken()) return;
    try {
      const res = await fetch('/api/notifications/unread-count', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count ?? 0);
      }
    } catch { /* silent */ }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user || !getToken()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/notifications', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.isRead).length);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [user]);

  const markRead = useCallback(async (id) => {
    if (!getToken()) return;
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH', headers: authHeaders() });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  }, []);

  const markAllRead = useCallback(async () => {
    if (!getToken()) return;
    try {
      await fetch('/api/notifications/read-all', { method: 'PATCH', headers: authHeaders() });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    fetchNotifications();
    intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [user, fetchNotifications, fetchUnreadCount]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      fetchNotifications,
      markRead,
      markAllRead
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
