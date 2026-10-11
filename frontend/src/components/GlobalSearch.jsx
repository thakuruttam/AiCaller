import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid, Users, CreditCard, LifeBuoy, Activity, Bell, Settings,
  Megaphone, PhoneCall, UserRound,
} from 'lucide-react';
import Input from './ui/Input';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

// Plain navigation shortcuts — intentionally excludes Admin Panel, even for
// super admins. Everything else in the app is fair game. Billing moved under
// Admin Panel (SUPER_ADMIN only), so it's filtered out for everyone else.
const SHORTCUTS = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutGrid },
  { id: 'team', label: 'My Team', path: '/team', icon: Users },
  { id: 'billing', label: 'Billing', path: '/billing', icon: CreditCard, superAdminOnly: true },
  { id: 'support', label: 'Support', path: '/support', icon: LifeBuoy },
  { id: 'usage', label: 'Usage', path: '/usage', icon: Activity },
  { id: 'notifications', label: 'Notifications', path: '/notifications', icon: Bell },
  { id: 'settings', label: 'Settings', path: '/settings/workspace', icon: Settings },
];

const MAX_PER_GROUP = 5;

// Campaigns, contacts and calls all come from the one already-tenant-scoped
// GET /api/campaigns payload (it embeds campaignContacts.contact and
// callLogs) — no extra endpoints needed for those three groups.
function buildResults(q, data, isSuperAdmin) {
  const groups = [];

  const shortcuts = SHORTCUTS
    .filter(s => (isSuperAdmin || !s.superAdminOnly) && s.label.toLowerCase().includes(q))
    .slice(0, MAX_PER_GROUP)
    .map(s => ({ id: `shortcut-${s.id}`, label: s.label, path: s.path, icon: s.icon }));
  if (shortcuts.length) groups.push({ label: 'Shortcuts', items: shortcuts });

  // Each matching campaign surfaces its three views, not just the report,
  // so a search lands wherever the person actually meant to go. Capped by
  // campaign (not by item) so a campaign's three links always stay together.
  const campaigns = (data.campaigns || [])
    .filter(c => c.name?.toLowerCase().includes(q))
    .slice(0, Math.ceil(MAX_PER_GROUP / 3))
    .flatMap(c => [
      { id: `campaign-${c.id}-overview`, label: c.name, sublabel: 'Overview', path: `/edit-campaign/${c.id}`, icon: Megaphone },
      { id: `campaign-${c.id}-details`, label: c.name, sublabel: 'Details', path: `/campaigns/${c.id}`, icon: Megaphone },
      { id: `campaign-${c.id}-report`, label: c.name, sublabel: 'Report', path: `/campaigns/${c.id}/report`, icon: Megaphone },
    ]);
  if (campaigns.length) groups.push({ label: 'Campaigns', items: campaigns });

  const contactMap = new Map();
  (data.campaigns || []).forEach(c => {
    (c.campaignContacts || []).forEach(cc => {
      const contact = cc.contact;
      if (!contact || contactMap.has(contact.id)) return;
      if (contact.name?.toLowerCase().includes(q) || contact.phone?.includes(q)) {
        contactMap.set(contact.id, {
          id: `contact-${contact.id}`, label: contact.name, sublabel: contact.phone,
          path: `/campaigns/${c.id}`, icon: UserRound,
        });
      }
    });
  });
  const contacts = Array.from(contactMap.values()).slice(0, MAX_PER_GROUP);
  if (contacts.length) groups.push({ label: 'Contacts', items: contacts });

  const calls = [];
  (data.campaigns || []).forEach(c => {
    const contactById = {};
    (c.campaignContacts || []).forEach(cc => { if (cc.contact) contactById[cc.contact.id] = cc.contact; });
    (c.callLogs || []).forEach(log => {
      const contact = contactById[log.contactId];
      const matches = contact?.name?.toLowerCase().includes(q) || c.name?.toLowerCase().includes(q);
      if (matches) {
        calls.push({
          id: `call-${log.id}`, label: contact?.name || 'Call', sublabel: `${c.name} · ${log.status}`,
          path: `/campaign/${c.id}/calls/${log.id}`, icon: PhoneCall,
        });
      }
    });
  });
  if (calls.length) groups.push({ label: 'Calls', items: calls.slice(0, MAX_PER_GROUP) });

  const tickets = (data.tickets || [])
    .filter(t => t.subject?.toLowerCase().includes(q))
    .slice(0, MAX_PER_GROUP)
    .map(t => ({ id: `ticket-${t.id}`, label: t.subject, path: `/support?ticket=${t.id}`, icon: LifeBuoy }));
  if (tickets.length) groups.push({ label: 'Support tickets', items: tickets });

  const members = (data.members || [])
    .filter(m => m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))
    .slice(0, MAX_PER_GROUP)
    .map(m => ({ id: `member-${m.id || m.email}`, label: m.name, sublabel: m.email, path: '/team', icon: Users }));
  if (members.length) groups.push({ label: 'Team', items: members });

  return groups;
}

export default function GlobalSearch() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [data, setData] = useState({ campaigns: [], tickets: [], members: [] });
  const containerRef = useRef(null);
  const loadedRef = useRef(false);
  const loadingRef = useRef(false);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const ensureData = async () => {
    if (loadedRef.current || loadingRef.current) return;
    loadingRef.current = true;
    setFetching(true);
    try {
      const [campaignsRes, ticketsRes, membersRes] = await Promise.allSettled([
        api.get('/api/campaigns'),
        api.get('/api/support'),
        user?.workspaceId ? api.get(`/api/workspaces/${user.workspaceId}/members`) : Promise.resolve({ data: [] }),
      ]);
      setData({
        campaigns: campaignsRes.status === 'fulfilled' ? campaignsRes.value.data : [],
        tickets: ticketsRes.status === 'fulfilled' ? (ticketsRes.value.data.tickets || []) : [],
        members: membersRes.status === 'fulfilled' ? membersRes.value.data : [],
      });
      loadedRef.current = true;
    } finally {
      loadingRef.current = false;
      setFetching(false);
    }
  };

  useEffect(() => {
    const q = query.trim();
    if (!q) { setOpen(false); return undefined; }
    const t = setTimeout(() => {
      ensureData();
      setOpen(true);
      setActiveIndex(0);
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const q = query.trim().toLowerCase();
  const results = q ? buildResults(q, data, user?.role === 'SUPER_ADMIN') : [];
  const flat = results.flatMap(g => g.items);

  const go = (item) => {
    navigate(item.path);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open || flat.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const item = flat[activeIndex]; if (item) go(item); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        icon="search"
        aria-label="Search"
        placeholder="Search campaigns, calls, contacts, tickets, team..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (query.trim()) setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[70vh] overflow-y-auto rounded-control border border-border bg-card dark:bg-ink-200 shadow-lg">
          {fetching && !loadedRef.current ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">Searching…</div>
          ) : flat.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">No results for "{query}"</div>
          ) : (
            results.map(group => (
              <div key={group.label} className="py-1.5">
                <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                  {group.label}
                </div>
                {group.items.map(item => {
                  const idx = flat.indexOf(item);
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => go(item)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm ${idx === activeIndex ? 'bg-paper-200 dark:bg-ink-300/60' : ''}`}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 min-w-0 truncate">{item.label}</span>
                      {item.sublabel && (
                        <span className="shrink-0 text-xs text-muted-foreground">{item.sublabel}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
