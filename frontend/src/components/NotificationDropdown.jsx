import { useState, useRef, useEffect } from 'react';
import { useNotifications } from '../context/NotificationContext';

const TYPE_META = {
  CAMPAIGN_CREATED:     { icon: '🚀', color: 'text-blue-500' },
  CAMPAIGN_STARTED:     { icon: '▶️', color: 'text-green-500' },
  CAMPAIGN_PAUSED:      { icon: '⏸️', color: 'text-yellow-500' },
  CAMPAIGN_KILLED:      { icon: '🛑', color: 'text-red-500' },
  CAMPAIGN_RERUN:       { icon: '🔁', color: 'text-teal-500' },
  CAMPAIGN_COMPLETED:   { icon: '✅', color: 'text-green-600' },
  CALL_COMPLETED:       { icon: '📞', color: 'text-blue-400' },
  CALL_FAILED:          { icon: '❌', color: 'text-red-400' },
  MEMBER_INVITED:       { icon: '✉️', color: 'text-teal-500' },
  MEMBER_JOINED:        { icon: '👋', color: 'text-teal-500' },
  MEMBER_ROLE_CHANGED:  { icon: '🔑', color: 'text-orange-500' },
  MEMBER_REMOVED:       { icon: '🚪', color: 'text-gray-500' },
};

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, fetchNotifications, markRead, markAllRead } = useNotifications();
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

  const handleClick = (n) => {
    if (!n.isRead) markRead(n.id);
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
            {loading && notifications.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">Loading…</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">No notifications yet</div>
            )}
            {notifications.map(n => {
              const meta = TYPE_META[n.type] || { icon: '🔔', color: 'text-gray-500' };
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-gray-50 dark:hover:bg-gray-700/60 transition-colors ${!n.isRead ? 'bg-teal-50/60 dark:bg-teal-900/20' : ''}`}
                >
                  <span className="text-lg leading-none mt-0.5">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${!n.isRead ? 'text-gray-900 dark:text-gray-50' : 'text-gray-700 dark:text-gray-300'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{n.body}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && (
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
