import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import * as notificationsApi from '../api/notifications';

const NotificationContext = createContext(null);

const POLL_INTERVAL = 30_000;
const RECENT_LIMIT = 10;

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      setUnreadCount(await notificationsApi.fetchUnreadCount());
    } catch { /* silent */ }
  }, [user]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { items } = await notificationsApi.fetchNotifications({ page: 1, limit: RECENT_LIMIT });
      setNotifications(items);
      // Don't derive unreadCount from this list — it's capped to the most
      // recent few, so it silently under-reports and fights with
      // fetchUnreadCount()'s real (uncapped) count, making the badge flicker
      // between the two values. fetchUnreadCount is the only source of truth.
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [user]);

  const markRead = useCallback(async (id) => {
    try {
      await notificationsApi.markRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
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
    fetchUnreadCount();
    intervalRef.current = setInterval(fetchUnreadCount, POLL_INTERVAL);
    return () => clearInterval(intervalRef.current);
  }, [user, fetchNotifications, fetchUnreadCount]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      fetchNotifications,
      // The notifications page mutates rows directly through the API module,
      // then calls this so the bell badge stays in step.
      refreshUnreadCount: fetchUnreadCount,
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
