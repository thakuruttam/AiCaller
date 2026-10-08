import React, { useState, useEffect } from 'react';
import {
  Page, PageHeader, Button, IconButton, StatusBadge,
  Table, THead, Th, TBody, Tr, Td, CellStack, RowActions, TableToolbar, SkeletonRow, EmptyState,
  FilterBar, statusLabel,
} from '../components/ui';
import { useSort } from '../hooks/useSort';
import { useFacets } from '../hooks/useFacets';
import { exportCsv } from '../lib/exportCsv';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  { value: 'technical',  label: 'Technical Support' },
  { value: 'billing',    label: 'Billing & Subscription' },
  { value: 'feature',    label: 'Feature Request' },
  { value: 'account',   label: 'Account Management' },
  { value: 'general',   label: 'General Question' },
];

const FAQS = [
  { q: 'How do I create a new campaign?', a: 'Click "New Campaign" in the left sidebar. The Campaign Wizard guides you through 7 steps: pick a call module, configure settings, define data to collect, set scoring questions, upload contacts, and review before launch.' },
  { q: "Why aren't my calls connecting?", a: 'Verify your Twilio credentials in the environment config. Ensure phone numbers use E.164 format (+1XXXXXXXXXX). Check your Twilio account balance and confirm the caller ID is active and verified.' },
  { q: 'How do I upload contacts?', a: 'In Step 5 of the Campaign Wizard (or from Campaign Details), click "Upload Contacts" and pick a CSV. The column mapper lets you link columns to Name, Phone, and optional Tag fields.' },
  { q: "What's the difference between campaign types?", a: 'AI Caller Pro supports 5 types: HR (employee engagement), Recruiter (candidate outreach), Sales (lead qualification), Loan Recovery (payment reminders), and Feedback (customer satisfaction). Each shapes the AI tone and evaluation criteria.' },
  { q: 'How does AI scoring work?', a: 'After each call, the evaluation pipeline scores 0–100 based on question coverage, sentiment analysis, identity verification (if enabled), and custom scoring rules per campaign. Scores appear in the Campaign Report.' },
  { q: 'Can I share a campaign report externally?', a: 'Yes. Open a campaign report and click "Share" to generate a time-limited read-only link. Recipients can view scores and transcripts without needing an account.' },
  { q: "What happens when a contact doesn't answer?", a: "The call is logged as NO_ANSWER. Retry behavior can be configured in Campaign Settings. You can also manually re-queue failed calls from the Admin Panel." },
  { q: 'How do I add team members to my workspace?', a: 'Go to Settings → Members tab and click "Invite Member." Enter their email and choose a role: Admin (full access), Editor (create/edit campaigns), or Viewer (read-only).' },
];

function FaqItem({ q, a, open, onToggle }) {
  return (
    <div
      className={`py-4 border-b border-paper-400 dark:border-ink-400 cursor-pointer group transition-colors hover:bg-paper-200/50 dark:hover:bg-ink-400/50 ${open ? 'bg-paper-200/50 dark:bg-ink-300/50' : ''}`}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between gap-4">
        <span className={`text-sm font-medium transition-colors ${open ? 'text-brand-500' : 'text-ink-100 dark:text-paper-200 group-hover:text-brand-500'}`}>
          {q}
        </span>
        <span className={`material-symbols-outlined text-ink-800 shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-brand-500' : 'group-hover:text-brand-500'}`}>
          expand_more
        </span>
      </div>
      {open && (
        <p className="mt-3 text-sm text-ink-700 dark:text-ink-900 leading-relaxed border-l-2 border-brand-200 pl-4">
          {a}
        </p>
      )}
    </div>
  );
}

function TicketModal({ ticket: initial, onClose, onRefresh }) {
  const { addToast } = useToast();
  const [ticket, setTicket] = useState(initial);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  const refresh = async () => {
    const res = await api.get(`/api/support/${ticket.id}`);
    setTicket(res.data);
    onRefresh();
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await api.post(`/api/support/${ticket.id}/reply`, { message: reply });
      await refresh();
      setReply('');
      addToast('Reply sent', 'success');
    } catch { addToast('Failed to send reply', 'error'); }
    finally { setSending(false); }
  };

  const changeStatus = async (status) => {
    setStatusLoading(true);
    try {
      await api.patch(`/api/support/${ticket.id}/status`, { status });
      await refresh();
      addToast(status === 'CLOSED' ? 'Ticket closed' : 'Ticket reopened', 'success');
    } catch { addToast('Failed to update ticket', 'error'); }
    finally { setStatusLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="bg-card dark:bg-muted rounded-2xl relative shadow-overlay w-full max-w-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-start justify-between p-6 border-b border-paper-400 dark:border-ink-400 shrink-0">
          <div>
            <p className="text-xs font-medium text-ink-800 capitalize mb-1">{ticket.category}</p>
            <h3 className="text-sm font-semibold text-ink-100 dark:text-paper-200">{ticket.subject}</h3>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={ticket.status} />
            {ticket.status === 'CLOSED' ? (
              <Button variant="subtle" size="sm" onClick={() => changeStatus('OPEN')} disabled={statusLoading}>Reopen</Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => changeStatus('CLOSED')} disabled={statusLoading}>Close</Button>
            )}
            <IconButton tone="neutral" size="md" title="Close" icon="close" onClick={onClose} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
              {ticket.user?.avatarUrl
                ? <img src={ticket.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                : ticket.user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-medium text-ink-100 dark:text-paper-200">{ticket.user?.name}</p>
                <p className="text-xs text-ink-800">{new Date(ticket.createdAt).toLocaleString()}</p>
              </div>
              <div className="bg-paper-200 dark:bg-ink-50 rounded-card rounded-tl-sm p-4 text-sm text-ink-500 dark:text-ink-900 leading-relaxed whitespace-pre-wrap">
                {ticket.message}
              </div>
            </div>
          </div>

          {(ticket.replies || []).map(r => (
            <div key={r.id} className={`flex gap-3 ${r.isAdmin ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden ${r.isAdmin ? 'bg-brand-500' : 'bg-paper-700'}`}>
                {r.user?.avatarUrl
                  ? <img src={r.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  : r.user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <div className={`flex items-center gap-2 mb-2 ${r.isAdmin ? 'flex-row-reverse' : ''}`}>
                  <p className="text-xs font-medium text-ink-100 dark:text-paper-200">{r.user?.name}</p>
                  {r.isAdmin && <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-500">Support</span>}
                  <p className="text-xs text-ink-800">{new Date(r.createdAt).toLocaleString()}</p>
                </div>
                <div className={`rounded-card p-4 text-sm leading-relaxed whitespace-pre-wrap ${r.isAdmin ? 'bg-brand-100 text-brand-500 dark:bg-brand-500/20 dark:text-brand-300 rounded-tr-sm' : 'bg-paper-200 dark:bg-ink-50 text-ink-500 dark:text-ink-900 rounded-tl-sm'}`}>
                  {r.message}
                </div>
              </div>
            </div>
          ))}

          {ticket.status === 'CLOSED' && (
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-paper-500 dark:bg-ink-300" />
              <span className="text-xs text-ink-800 font-medium">Ticket closed</span>
              <div className="flex-1 h-px bg-paper-500 dark:bg-ink-300" />
            </div>
          )}
        </div>

        {ticket.status !== 'CLOSED' && (
          <div className="p-5 border-t border-paper-400 dark:border-ink-400 shrink-0">
            <div className="flex gap-3">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(); }}
                placeholder="Add a reply…"
                rows={3}
                className="flex-1 text-sm bg-paper-200 dark:bg-ink-50 border border-paper-500 dark:border-ink-400 rounded-card px-4 py-3 resize-none outline-none focus:ring-2 focus:ring-brand-500 text-ink-100 dark:text-paper-200 placeholder:text-ink-800"
              />
              <Button variant="primary" size="md" onClick={sendReply} disabled={sending || !reply.trim()}>{sending ? 'Sending…' : 'Send'}</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Support() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [openFaq, setOpenFaq] = useState(null);
  const [form, setForm] = useState({ subject: '', message: '', category: 'technical' });
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const fetchTickets = async () => {
    try {
      const res = await api.get('/api/support');
      setTickets(res.data.tickets || []);
    } catch { /* silent */ }
    finally { setTicketsLoading(false); }
  };

  useEffect(() => { fetchTickets(); }, []);

  const categoryLabel = (value) => CATEGORIES.find(c => c.value === value)?.label || value;

  const filters = useFacets(tickets, {
    status: { label: 'Status', get: t => t.status, format: statusLabel },
    category: { label: 'Category', get: t => t.category, format: categoryLabel },
  });

  const { sorted: sortedTickets, sortProps } = useSort(filters.filtered, {
    subject: t => t.subject,
    status: t => t.status,
    created: t => t.createdAt,
    activity: t => t._count?.replies || 0,
  });

  const handleExport = () => exportCsv(`support-tickets-${new Date().toISOString().slice(0, 10)}`, [
    { header: 'Subject', value: t => t.subject },
    { header: 'Category', value: t => categoryLabel(t.category) },
    { header: 'Status', value: t => statusLabel(t.status) },
    { header: 'Created', value: t => t.createdAt && new Date(t.createdAt).toISOString().slice(0, 10) },
    { header: 'Replies', value: t => t._count?.replies || 0 },
  ], sortedTickets);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      addToast('Please fill in subject and details.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/api/support', form);
      addToast("Ticket created — we'll get back to you shortly.", 'success');
      setForm({ subject: '', message: '', category: 'technical' });
      fetchTickets();
    } catch { addToast('Failed to submit. Please try again.', 'error'); }
    finally { setSubmitting(false); }
  };

  const openTicket = async (t) => {
    try {
      const res = await api.get(`/api/support/${t.id}`);
      setSelectedTicket(res.data);
    } catch { addToast('Failed to load ticket', 'error'); }
  };

  return (
    <div className="min-h-screen">
      <Page>
        <PageHeader
          title="Support Center"
          subtitle="Get help, browse common questions, or open a support ticket."
          actions={
            <a
            href="mailto:support@aicallerpro.com"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-control text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-colors active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2"
          >
            <span className="material-symbols-outlined text-[18px]">mail</span>
            Email Support
          </a>
          }
        />

        {/* 2-column: FAQ + Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-14">

          {/* FAQ — left 7 cols */}
          <div className="lg:col-span-7">
            <h2 className="text-sm font-semibold text-ink-100 dark:text-paper-200 mb-5">Common Questions</h2>
            <div className="border-t border-paper-500 dark:border-ink-400">
              {FAQS.map((f, i) => (
                <FaqItem
                  key={i}
                  q={f.q}
                  a={f.a}
                  open={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </div>

          {/* Form — right 5 cols */}
          <div className="lg:col-span-5">
            <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-8">
              <h2 className="text-sm font-semibold text-ink-100 dark:text-paper-200 mb-1">New Support Request</h2>
              <p className="text-xs text-ink-800 mb-6">Average response time: &lt; 2 hours</p>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-700 dark:text-ink-900 ">Subject</label>
                  <input
                    value={form.subject}
                    onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                    placeholder="Briefly describe the issue"
                    className="w-full bg-paper-200 dark:bg-ink-50 border border-paper-500 dark:border-ink-400 rounded-control px-3 py-2.5 text-sm text-ink-100 dark:text-paper-200 placeholder:text-ink-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/25 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-700 dark:text-ink-900 ">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full bg-paper-200 dark:bg-ink-50 border border-paper-500 dark:border-ink-400 rounded-control px-3 py-2.5 text-sm text-ink-100 dark:text-paper-200 focus:border-brand-500 outline-none transition-all cursor-pointer"
                  >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-ink-700 dark:text-ink-900 ">Details</label>
                  <textarea
                    value={form.message}
                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="Provide as much detail as possible…"
                    rows={4}
                    className="w-full bg-paper-200 dark:bg-ink-50 border border-paper-500 dark:border-ink-400 rounded-control px-3 py-2.5 text-sm text-ink-100 dark:text-paper-200 placeholder:text-ink-800 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/25 outline-none transition-all resize-none"
                  />
                </div>
                <div className="pt-1">
                  <Button variant="primary" size="md" type="submit" disabled={submitting}>
                    {submitting && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                    {submitting ? 'Creating…' : 'Create Ticket'}
                  </Button>
                  <p className="text-xs text-center mt-3 text-ink-800">
                    Submitting as <span className="font-medium text-ink-600 dark:text-ink-900">{user?.email}</span>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Recent Tickets */}
        <section className="bg-card dark:bg-muted rounded-2xl shadow-primary overflow-hidden">
          <TableToolbar
            title="Recent tickets"
            count={tickets.length ? sortedTickets.length : null}
            actions={tickets.length > 0 && (
              <IconButton title="Export CSV" icon="download" onClick={handleExport} disabled={!sortedTickets.length} />
            )}
          >
            {tickets.length > 0 && <FilterBar filters={filters} />}
          </TableToolbar>

          {ticketsLoading ? (
            <Table>
              <TBody>
                {Array.from({ length: 3 }).map((_, i) => <SkeletonRow key={i} cols={5} />)}
              </TBody>
            </Table>
          ) : tickets.length === 0 ? (
            <EmptyState icon="inbox" title="No tickets yet" body="Fill out the form above and we'll get back to you." />
          ) : sortedTickets.length === 0 ? (
            <EmptyState
              icon="filter_alt_off"
              title="No tickets match your filters"
              body="Try a different status or category, or clear the filters."
              action={<Button variant="secondary" onClick={filters.reset}>Clear filters</Button>}
            />
          ) : (
            <Table>
              <THead>
                <Th {...sortProps('subject')}>Ticket</Th>
                <Th {...sortProps('status')}>Status</Th>
                <Th {...sortProps('created')}>Created</Th>
                <Th align="right" {...sortProps('activity')}>Activity</Th>
                <Th><span className="sr-only">Actions</span></Th>
              </THead>
              <TBody>
                {sortedTickets.map(t => (
                  <Tr key={t.id} onClick={() => openTicket(t)}>
                    <Td>
                      <CellStack
                        title={t.subject}
                        meta={categoryLabel(t.category)}
                      />
                    </Td>
                    <Td>
                      <StatusBadge status={t.status} />
                    </Td>
                    <Td muted className="whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Td>
                    <Td numeric muted>
                      {t._count?.replies || 0} {t._count?.replies === 1 ? 'reply' : 'replies'}
                    </Td>
                    <Td align="right">
                      <RowActions>
                        <span className="material-symbols-outlined [--icon-size:18px] text-muted-foreground">chevron_right</span>
                      </RowActions>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </section>

        {selectedTicket && (
          <TicketModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
            onRefresh={fetchTickets}
          />
        )}
      </Page>
    </div>
  );
}
