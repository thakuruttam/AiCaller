import api from './axios';

// One place for the notification endpoints. Both the bell dropdown and the
// notifications page go through here, on the shared axios instance — so token
// refresh and the base URL are handled the same way as everywhere else.

export async function fetchNotifications({ page = 1, limit = 20, status, type, q } = {}) {
  const params = { page, limit };
  if (status && status !== 'all') params.status = status;
  if (type) params.type = Array.isArray(type) ? type.join(',') : type;
  if (q) params.q = q;

  const { data } = await api.get('/api/notifications', { params });
  // Tolerate the old array-shaped response so a stale server can't blank the UI.
  return Array.isArray(data)
    ? { items: data, page: 1, limit: data.length, total: data.length, pages: 1,
        counts: { all: data.length, unread: data.filter(n => !n.isRead).length, read: 0 } }
    : data;
}

export async function fetchUnreadCount() {
  const { data } = await api.get('/api/notifications/unread-count');
  return data.count ?? 0;
}

export const markRead     = (id) => api.patch(`/api/notifications/${id}/read`);
export const markUnread   = (id) => api.patch(`/api/notifications/${id}/unread`);
export const markAllRead  = ()   => api.patch('/api/notifications/read-all');
export const markManyRead = (ids, isRead = true) =>
  api.patch('/api/notifications/read-many', { ids, isRead });

export const removeNotification = (id) => api.delete(`/api/notifications/${id}`);
export const removeMany = (ids) =>
  api.delete('/api/notifications', { params: { ids: ids.join(',') } });
export const clearRead = () =>
  api.delete('/api/notifications', { params: { status: 'read' } });
export const clearAll = () =>
  api.delete('/api/notifications', { params: { status: 'all' } });
