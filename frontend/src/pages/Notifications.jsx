import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Page, PageHeader, EmptyState, Card, Button, IconButton, Badge, Input, Select, Checkbox, Pagination,
} from '../components/ui';
import Spinner from '../components/Spinner';
import { useNotifications } from '../context/NotificationContext';
import { useToast } from '../context/ToastContext';
import * as notificationsApi from '../api/notifications';
import { dateGroup, TYPE_GROUPS, typesForGroup } from '../components/notificationMeta';
import NotificationRow from '../components/NotificationRow';

const PER_PAGE = 20;

const STATUS_TABS = [
  { value: 'all',    label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read',   label: 'Read' },
];

export default function Notifications() {
  const { addToast } = useToast();
  const { refreshUnreadCount } = useNotifications();
  const navigate = useNavigate();

  const [status, setStatus] = useState('all');
  const [group, setGroup] = useState('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);

  const [data, setData] = useState({ items: [], total: 0, pages: 1, counts: { all: 0, unread: 0, read: 0 } });
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const [selected, setSelected] = useState(() => new Set());
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQuery(query); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    const mine = ++reqId.current;
    setLoading(true);
    try {
      const res = await notificationsApi.fetchNotifications({
        page, limit: PER_PAGE, status,
        type: typesForGroup(group),
        q: debouncedQuery,
      });
      // A slower earlier request must not overwrite a newer response.
      if (mine === reqId.current) setData(res);
    } catch {
      if (mine === reqId.current) addToast('Could not load notifications', 'error');
    } finally {
      if (mine === reqId.current) setLoading(false);
    }
  }, [page, status, group, debouncedQuery, addToast]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) load(); });
    return () => { cancelled = true; };
  }, [load]);

  const items = data.items ?? [];
  const counts = data.counts ?? { all: 0, unread: 0, read: 0 };

  // Derived, not mirrored into state: a bulk action can only ever touch rows
  // that are currently on screen, and there is no effect to fall out of sync.
  const visibleSelected = useMemo(
    () => items.filter(n => selected.has(n.id)).map(n => n.id),
    [items, selected],
  );

  const withBusy = async (id, fn) => {
    setBusyIds(prev => new Set(prev).add(id));
    try { await fn(); } finally {
      setBusyIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const afterChange = async () => {
    await Promise.all([load(), refreshUnreadCount?.()]);
  };

  const toggleRead = (n) => withBusy(n.id, async () => {
    try {
      await (n.isRead ? notificationsApi.markUnread(n.id) : notificationsApi.markRead(n.id));
      await afterChange();
    } catch { addToast('Could not update notification', 'error'); }
  });

  // Open marks read first so the badge and row state are correct when the user
  // comes back, then navigates to whatever the notification points at.
  const open = async (n) => {
    if (!n.isRead) {
      try { await notificationsApi.markRead(n.id); await refreshUnreadCount?.(); } catch { /* navigate anyway */ }
    }
    navigate(n.link);
  };

  const remove = (n) => withBusy(n.id, async () => {
    try {
      await notificationsApi.removeNotification(n.id);
      addToast('Notification deleted', 'success');
      await afterChange();
    } catch { addToast('Could not delete notification', 'error'); }
  });

  const bulk = async (fn, message) => {
    const ids = visibleSelected;
    if (!ids.length) return;
    try {
      await fn(ids);
      setSelected(new Set());
      addToast(message(ids.length), 'success');
      await afterChange();
    } catch { addToast('Bulk action failed', 'error'); }
  };

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      addToast('All notifications marked as read', 'success');
      await afterChange();
    } catch { addToast('Could not mark all as read', 'error'); }
  };

  const clearRead = async () => {
    try {
      const { data: res } = await notificationsApi.clearRead();
      addToast(`Cleared ${res?.count ?? 0} read notification${res?.count === 1 ? '' : 's'}`, 'success');
      await afterChange();
    } catch { addToast('Could not clear read notifications', 'error'); }
  };

  const allVisibleSelected = items.length > 0 && visibleSelected.length === items.length;
  const toggleSelectAll = () =>
    setSelected(allVisibleSelected ? new Set() : new Set(items.map(n => n.id)));

  const toggleSelect = (id) =>
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Date headings are derived from the rows currently on the page.
  const grouped = useMemo(() => {
    const out = [];
    for (const n of items) {
      const label = dateGroup(n.createdAt);
      const last = out[out.length - 1];
      if (last?.label === label) last.rows.push(n);
      else out.push({ label, rows: [n] });
    }
    return out;
  }, [items]);

  const isFiltered = status !== 'all' || group !== 'all' || Boolean(debouncedQuery);

  return (
    <Page>
      <PageHeader
        title="Notifications"
        subtitle="Everything that happened across your campaigns, calls, team and billing."
        actions={
          <>
            <Button variant="secondary" icon="mark_email_read" onClick={markAllRead} disabled={counts.unread === 0}>
              Mark all read
            </Button>
            <Button variant="secondary" icon="delete_sweep" onClick={clearRead} disabled={counts.read === 0}>
              Clear read
            </Button>
          </>
        }
      />

      <Card padded={false} className="overflow-hidden">
        {/* Toolbar: status tabs, type filter, search */}
        <div className="px-7 py-5 border-b border-paper-400 dark:border-ink-400 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-1 bg-paper-300 dark:bg-ink-300 p-1 rounded-control w-fit">
            {STATUS_TABS.map(tab => (
              <Button variant="ghost" size="sm" key={tab.value} onClick={() => { setStatus(tab.value); setPage(1); }} aria-pressed={status === tab.value}>
                {tab.label}
                <span className="ml-1.5 tabular text-muted-foreground">{counts[tab.value] ?? 0}</span>
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <Select
              value={group}
              onChange={(e) => { setGroup(e.target.value); setPage(1); }}
              aria-label="Filter by type"
              className="!w-auto min-w-[140px]"
            >
              {TYPE_GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </Select>
            <div className="flex-1 lg:w-64">
              <Input
                icon="search"
                placeholder="Search notifications..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search notifications"
              />
            </div>
          </div>
        </div>

        {/* Bulk action bar — only present when there is a selection */}
        {visibleSelected.length > 0 && (
          <div className="px-7 py-3 bg-brand-500/10 border-b border-paper-400 dark:border-ink-400 flex items-center justify-between gap-4">
            <span className="text-[13px] font-medium text-foreground">
              {visibleSelected.length} selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" icon="mark_email_read"
                onClick={() => bulk(ids => notificationsApi.markManyRead(ids, true), n => `${n} marked as read`)}>
                Mark read
              </Button>
              <Button variant="secondary" size="sm" icon="mark_email_unread"
                onClick={() => bulk(ids => notificationsApi.markManyRead(ids, false), n => `${n} marked as unread`)}>
                Mark unread
              </Button>
              <Button variant="danger" size="sm" icon="delete"
                onClick={() => bulk(notificationsApi.removeMany, n => `${n} deleted`)}>
                Delete
              </Button>
            </div>
          </div>
        )}

        {/* Select-all */}
        {items.length > 0 && (
          <div className="px-7 py-2.5 border-b border-paper-400 dark:border-ink-400 flex items-center gap-4">
            <Checkbox
              checked={allVisibleSelected}
              indeterminate={!allVisibleSelected && visibleSelected.length > 0}
              onChange={toggleSelectAll}
              aria-label="Select all notifications on this page"
            />
            <span className="text-xs text-muted-foreground">
              {allVisibleSelected ? 'All on this page selected' : 'Select all on this page'}
            </span>
          </div>
        )}

        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Spinner size={22} />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon="notifications"
            title={isFiltered ? 'No notifications match these filters' : 'No notifications yet'}
            body={
              isFiltered
                ? 'Try a different status, type or search term.'
                : "When campaigns run, calls finish or your team changes, you'll see it here."
            }
            action={isFiltered && (
              <Button variant="secondary" onClick={() => { setStatus('all'); setGroup('all'); setQuery(''); setPage(1); }}>
                Clear filters
              </Button>
            )}
          />
        ) : (
          <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {grouped.map(({ label, rows }) => (
              <section key={label}>
                <h2 className="px-7 py-2 bg-paper-200 dark:bg-ink-50 text-[11px] font-medium text-muted-foreground border-b border-paper-400 dark:border-ink-400">
                  {label}
                </h2>
                <ul className="divide-y divide-paper-400 dark:divide-ink-400">
                  {rows.map(n => (
                    <li key={n.id}>
                      <NotificationRow
                        notification={n}
                        onOpen={open}
                        leading={
                          <Checkbox
                            checked={selected.has(n.id)}
                            onChange={() => toggleSelect(n.id)}
                            aria-label={`Select "${n.title}"`}
                            className="mt-1"
                          />
                        }
                        actions={<>
                          <IconButton
                            size="sm"
                            title={n.isRead ? 'Mark as unread' : 'Mark as read'}
                            icon={n.isRead ? 'mark_email_unread' : 'mark_email_read'}
                            onClick={() => toggleRead(n)}
                            disabled={busyIds.has(n.id)}
                          />
                          <IconButton
                            size="sm"
                            tone="danger"
                            title="Delete"
                            icon="delete"
                            onClick={() => remove(n)}
                            disabled={busyIds.has(n.id)}
                          />
                        </>}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <Pagination
          page={page}
          totalPages={data.pages}
          totalRows={data.total}
          pageSize={PER_PAGE}
          onPageChange={setPage}
          label="notifications"
          compact
        />
      </Card>
    </Page>
  );
}
