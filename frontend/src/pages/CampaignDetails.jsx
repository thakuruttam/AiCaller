import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, Volume2, Users, Phone, Tag, Clock, BarChart3 } from 'lucide-react';
import SandboxAgent from './CampaignWizard/components/SandboxAgent.jsx';
import Modal from '../components/Modal';
import DebouncedSearch from '../components/DebouncedSearch';
import FullscreenWrapper from '../components/FullscreenWrapper';

const STATUS_BADGE = {
  completed:    'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-700',
  queued:       'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200 dark:bg-slate-700 dark:text-slate-400 dark:ring-slate-600',
  'in-progress':'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-700',
  failed:       'bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-700',
  cancelled:    'bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-700',
};

export default function CampaignDetails() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchCampaignDetails(); }, [id]);

  const fetchCampaignDetails = async () => {
    try {
      const res = await api.get('/api/campaigns');
      const camp = res.data.find(c => c.id === id);
      setCampaign(camp);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-sm text-zinc-400 dark:text-slate-500">Loading campaign…</div>
  );
  if (!campaign) return (
    <div className="flex items-center justify-center h-64 text-sm text-zinc-400 dark:text-slate-500">Campaign not found.</div>
  );

  const filteredContacts = (campaign.campaignContacts || []).filter(cc => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (cc.overrides?.name || cc.contact.name || '').toLowerCase().includes(q) ||
      (cc.contact.phone || '').toLowerCase().includes(q) ||
      (cc.overrides?.tag || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="animate-fade-in flex flex-col gap-6 flex-1">
      {/* Back */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-100 transition-colors max-w-fit"
      >
        <ArrowLeft size={14} /> Back to Dashboard
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-slate-100 tracking-tight">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
              {campaign.type}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-slate-400 ring-1 ring-inset ring-zinc-200 dark:ring-slate-600">
              <Users size={10} /> {campaign.campaignContacts?.length || 0} contacts
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/campaigns/${id}/report`}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50 active:bg-zinc-100 transition-colors"
          >
            <BarChart3 size={14} /> Report
          </Link>
          <button
            onClick={() => setIsSandboxOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50 active:bg-zinc-100 transition-colors"
          >
            <Volume2 size={14} /> AI Sandbox
          </button>
        </div>
      </div>

      {/* Contacts table */}
      <FullscreenWrapper
        title="Contacts & Calls"
        className="flex-1 min-h-0"
        actionNode={
          <DebouncedSearch
            onSearch={setSearchQuery}
            placeholder="Search name, phone, tag…"
            className="w-72"
          />
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-900">
              {['Name', 'Phone', 'Tags / Overrides', 'Status', 'Duration', ''].map(h => (
                <th key={h} className={`px-5 py-3 text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider ${h === '' ? 'text-right' : 'text-left'}`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-slate-700">
            {filteredContacts.map(cc => {
              const contact = cc.contact;
              const log = campaign.callLogs?.find(l => l.contactId === contact.id);
              return (
                <tr key={cc.id} className="hover:bg-zinc-50/70 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-zinc-900 dark:text-slate-100">
                    {cc.overrides?.name || contact.name}
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-zinc-500 dark:text-slate-400">{contact.phone}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-1">
                      {cc.overrides?.goals && (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700 ring-1 ring-blue-100">Script Override</span>
                      )}
                      {cc.overrides?.dataToCollect && (
                        <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700 ring-1 ring-violet-100">Q Override</span>
                      )}
                      {cc.overrides?.tag && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 dark:bg-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-600 dark:text-slate-400 ring-1 ring-zinc-200 dark:ring-slate-600">
                          <Tag size={8} /> {cc.overrides.tag}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {log ? (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_BADGE[log.status] || STATUS_BADGE.queued}`}>
                        {log.status}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400 dark:text-slate-500">No call</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-xs text-zinc-500 dark:text-slate-400">
                    {log?.durationMs ? `${Math.round(log.durationMs / 1000)}s` : '—'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {log && (
                      <Link
                        to={`/campaign/${id}/calls/${log.id}`}
                        className="inline-flex items-center rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50 shadow-sm transition-colors"
                      >
                        Transcript
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}

            {filteredContacts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-zinc-400 dark:text-slate-500">
                  {searchQuery ? 'No contacts match your search.' : 'No contacts in this campaign.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </FullscreenWrapper>

      <Modal
        isOpen={isSandboxOpen}
        onClose={() => setIsSandboxOpen(false)}
        title="AI Sandbox — Live Test"
        className="max-w-2xl w-full"
      >
        <SandboxAgent campaign={campaign} />
      </Modal>
    </div>
  );
}
