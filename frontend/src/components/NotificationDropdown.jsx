import { useState, useRef, useEffect } from 'react';
import { Button, IconButton } from '../components/ui';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import NotificationRow from './NotificationRow';
import { WaveLoader } from './ui';

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, fetchNotifications, markRead, markAllRead } = useNotifications();
  const navigate = useNavigate();
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    if (!open) fetchNotifications();
    setOpen(o => !o);
  };

  // Clicking a notification is meant to take you to the thing it is about —
  // marking it read on its own left every `link` dead from here.
  const handleClick = (n) => {
    if (!n.isRead) markRead(n.id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <Button variant="ghost" size="md" onClick={handleOpen} aria-label="Notifications">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-negative text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-card dark:bg-muted rounded-2xl shadow-overlay z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-paper-400 dark:border-ink-400">
            <span className="font-semibold text-sm text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} icon="mark_email_read">Mark all read</Button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-paper-400 dark:divide-ink-400">
            {loading && notifications.length === 0 && (
              <div className="flex justify-center px-4 py-8"><WaveLoader size="sm" className="text-brand-500" label="Loading notifications" /></div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
            )}
            {notifications.map(n => (
              <NotificationRow
                key={n.id}
                notification={n}
                compact
                onOpen={handleClick}
              />
            ))}
          </div>
          <div className="border-t border-paper-400 dark:border-ink-400">
            <Button
              variant="ghost"
              size="sm"
              fullWidth
              iconRight="arrow_forward"
              onClick={() => { setOpen(false); navigate('/notifications'); }}
            >
              View all notifications
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
