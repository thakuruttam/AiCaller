import React, { useState, useEffect } from 'react';
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

const STATUS_BADGE = {
  OPEN:        'bg-blue-50 text-blue-700 border border-blue-100',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 border border-amber-100',
  RESOLVED:    'bg-emerald-50 text-emerald-700 border border-emerald-100',
  CLOSED:      'bg-zinc-100 text-zinc-500 border border-zinc-200',
};

const STATUS_LABEL = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

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
      className={`py-4 border-b border-zinc-100 dark:border-slate-800 cursor-pointer group transition-colors hover:bg-zinc-50/50 dark:hover:bg-slate-700/50 ${open ? 'bg-zinc-50/50 dark:bg-slate-700/50' : ''}`}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between gap-4">
        <span className={`text-sm font-medium transition-colors ${open ? 'text-[#0d9488]' : 'text-zinc-800 dark:text-slate-100 group-hover:text-[#0d9488]'}`}>
          {q}
        </span>
        <span className={`material-symbols-outlined text-zinc-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180 text-[#0d9488]' : 'group-hover:text-[#0d9488]'}`}>
          expand_more
        </span>
      </div>
      {open && (
        <p className="mt-3 text-sm text-zinc-500 dark:text-slate-400 leading-relaxed border-l-2 border-[#b2f5ea] pl-4">
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
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-start justify-between p-6 border-b border-zinc-100 dark:border-slate-800 shrink-0">
          <div>
            <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider capitalize mb-1">{ticket.category}</p>
            <h3 className="text-base font-semibold text-zinc-900 dark:text-slate-100">{ticket.subject}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${STATUS_BADGE[ticket.status]}`}>
              {STATUS_LABEL[ticket.status]}
            </span>
            {ticket.status === 'CLOSED' ? (
              <button
                onClick={() => changeStatus('OPEN')}
                disabled={statusLoading}
                className="text-[11px] font-semibold px-3 py-1 rounded-lg border border-[#0d9488] text-[#0d9488] hover:bg-[#f0fdfa] disabled:opacity-50 transition-colors"
              >
                Reopen
              </button>
            ) : (
              <button
                onClick={() => changeStatus('CLOSED')}
                disabled={statusLoading}
                className="text-[11px] font-semibold px-3 py-1 rounded-lg border border-zinc-200 dark:border-slate-700 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                Close
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-slate-800 transition-colors">
              <span className="material-symbols-outlined text-zinc-400 text-[18px]">close</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#0d9488] flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
              {ticket.user?.avatarUrl
                ? <img src={ticket.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                : ticket.user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-semibold text-zinc-800 dark:text-slate-100">{ticket.user?.name}</p>
                <p className="text-[10px] text-zinc-400 font-mono">{new Date(ticket.createdAt).toLocaleString()}</p>
              </div>
              <div className="bg-zinc-50 dark:bg-slate-900 rounded-xl rounded-tl-sm p-4 text-sm text-zinc-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                {ticket.message}
              </div>
            </div>
          </div>

          {(ticket.replies || []).map(r => (
            <div key={r.id} className={`flex gap-3 ${r.isAdmin ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden ${r.isAdmin ? 'bg-[#0d9488]' : 'bg-zinc-300'}`}>
                {r.user?.avatarUrl
                  ? <img src={r.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                  : r.user?.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <div className={`flex items-center gap-2 mb-2 ${r.isAdmin ? 'flex-row-reverse' : ''}`}>
                  <p className="text-xs font-semibold text-zinc-800 dark:text-slate-100">{r.user?.name}</p>
                  {r.isAdmin && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#f0fdfa] text-[#0d9488]">Support</span>}
                  <p className="text-[10px] text-zinc-400 font-mono">{new Date(r.createdAt).toLocaleString()}</p>
                </div>
                <div className={`rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap ${r.isAdmin ? 'bg-[#f0fdfa] text-[#0d9488] dark:bg-[#0d9488]/20 dark:text-teal-300 rounded-tr-sm' : 'bg-zinc-50 dark:bg-slate-900 text-zinc-700 dark:text-slate-300 rounded-tl-sm'}`}>
                  {r.message}
                </div>
              </div>
            </div>
          ))}

          {ticket.status === 'CLOSED' && (
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-zinc-200 dark:bg-slate-700" />
              <span className="text-[11px] text-zinc-400 font-medium">Ticket closed</span>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-slate-700" />
            </div>
          )}
        </div>

        {ticket.status !== 'CLOSED' && (
          <div className="p-5 border-t border-zinc-100 dark:border-slate-800 shrink-0">
            <div className="flex gap-3">
              <textarea
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendReply(); }}
                placeholder="Add a reply…"
                rows={3}
                className="flex-1 text-sm bg-zinc-50 dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-xl px-4 py-3 resize-none outline-none focus:ring-2 focus:ring-[#0d9488] text-zinc-800 dark:text-slate-100 placeholder:text-zinc-400"
              />
              <button
                onClick={sendReply}
                disabled={sending || !reply.trim()}
                className="self-end bg-[#0d9488] hover:bg-[#0d9488] disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
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
      <div className="p-8 max-w-[1440px] mx-auto">

        {/* Page Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-[#0f172a] dark:text-slate-100 tracking-tight">Support Center</h1>
            <p className="text-base text-[#334155] dark:text-slate-400 mt-1">Get help, browse common questions, or open a support ticket.</p>
          </div>
          <a
            href="mailto:support@aicallerpro.com"
            className="flex items-center gap-2 bg-[#0d9488] hover:bg-[#0f766e] text-white px-6 py-3 rounded text-sm transition-all shadow-md active:scale-95"
            style={{fontFamily:'JetBrains Mono, monospace'}}
          >
            <span className="material-symbols-outlined text-[18px]">mail</span>
            Email Support
          </a>
        </div>

        {/* 2-column: FAQ + Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-14">

          {/* FAQ — left 7 cols */}
          <div className="lg:col-span-7">
            <h2 className="text-base font-semibold text-[#0f172a] dark:text-slate-100 mb-5">Common Questions</h2>
            <div className="border-t border-zinc-200 dark:border-slate-800">
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
            <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-800 rounded-xl shadow-sm p-8">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-slate-100 mb-1">New Support Request</h2>
              <p className="text-[11px] text-zinc-400 mb-6">Average response time: &lt; 2 hours</p>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">Subject</label>
                  <input
                    value={form.subject}
                    onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                    placeholder="Briefly describe the issue"
                    className="w-full bg-zinc-50 dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-slate-100 placeholder:text-zinc-400 focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]/20 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">Category</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full bg-zinc-50 dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-slate-100 focus:border-[#0d9488] outline-none transition-all cursor-pointer"
                  >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">Details</label>
                  <textarea
                    value={form.message}
                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="Provide as much detail as possible…"
                    rows={4}
                    className="w-full bg-zinc-50 dark:bg-slate-900 border border-zinc-200 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-slate-100 placeholder:text-zinc-400 focus:border-[#0d9488] focus:ring-1 focus:ring-[#0d9488]/20 outline-none transition-all resize-none"
                  />
                </div>
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-[#0d9488] hover:bg-[#0f766e] disabled:opacity-50 text-white py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
                  >
                    {submitting && <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                    {submitting ? 'Creating…' : 'Create Ticket'}
                  </button>
                  <p className="text-[10px] text-center mt-3 text-zinc-400">
                    Submitting as <span className="font-medium text-zinc-600 dark:text-slate-300">{user?.email}</span>
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Recent Tickets */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-slate-100">Recent Tickets</h2>
            {tickets.length > 0 && (
              <span className="text-[10px] bg-zinc-100 dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 text-zinc-500 font-bold px-2 py-0.5 rounded">
                {tickets.length} TOTAL
              </span>
            )}
          </div>

          {ticketsLoading ? (
            <div className="border border-zinc-200 dark:border-slate-800 rounded-xl py-12 text-center text-zinc-400 text-sm">Loading…</div>
          ) : tickets.length === 0 ? (
            <div className="border border-zinc-200 dark:border-slate-800 rounded-xl py-16 text-center">
              <span className="material-symbols-outlined text-zinc-200 dark:text-slate-700 text-[48px] block mb-3">inbox</span>
              <p className="text-zinc-400 text-sm">No tickets yet — fill out the form above and we'll get back to you.</p>
            </div>
          ) : (
            <div className="border border-zinc-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-slate-900 border-b border-zinc-200 dark:border-slate-800">
                    <th className="px-6 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Ticket Details</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-wider text-center">Activity</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-slate-800">
                  {tickets.map(t => (
                    <tr
                      key={t.id}
                      onClick={() => openTicket(t)}
                      className="hover:bg-zinc-50/60 dark:hover:bg-slate-900/60 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-zinc-900 dark:text-slate-100">{t.subject}</span>
                          <span className="text-xs text-zinc-400 capitalize mt-0.5">{CATEGORIES.find(c => c.value === t.category)?.label || t.category}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${STATUS_BADGE[t.status]}`}>
                          {STATUS_LABEL[t.status]}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-zinc-500 dark:text-slate-400">
                        {new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span className="text-xs font-medium text-zinc-400">
                          {t._count?.replies || 0} {t._count?.replies === 1 ? 'reply' : 'replies'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <span className="text-[#0d9488] dark:text-teal-400 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity hover:underline">
                          View
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onRefresh={fetchTickets}
        />
      )}
    </div>
  );
}
