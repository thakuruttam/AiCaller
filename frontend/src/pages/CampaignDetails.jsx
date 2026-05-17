import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { ArrowLeft, Volume2 } from 'lucide-react';
import SandboxAgent from './CampaignWizard/components/SandboxAgent.jsx';
import RoleGate from '../components/RoleGate';
import CampaignEvaluationReport from './CampaignEvaluationReport.jsx';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import DebouncedSearch from '../components/DebouncedSearch';
import FullscreenWrapper from '../components/FullscreenWrapper';

export default function CampaignDetails() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    fetchCampaignDetails();
  }, [id]);

  const fetchCampaignDetails = async () => {
    try {
      const res = await api.get('/api/campaigns');
      const camp = res.data.find(c => c.id === id);
      setCampaign(camp);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  // Handlers moved to AdminDashboard

  if (loading) return <div style={{padding: '2rem'}}>Loading campaign...</div>;
  if (!campaign) return <div style={{padding: '2rem'}}>Campaign not found</div>;

  return (
    <div className="animate-fade-in flex flex-col gap-4 h-full">
      <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium max-w-fit shrink-0">
         <ArrowLeft size={16} /> Back to Dashboard
      </Link>
      
      <div className="flex justify-between items-end border-b pb-4 shrink-0">
         <div>
            <h2 className="text-3xl font-bold tracking-tight m-0">{campaign.name}</h2>
            <div className="flex gap-3 mt-3">
               <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground">{campaign.type}</span>
               <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold bg-primary text-primary-foreground">{campaign.campaignContacts?.length || 0} Contacts</span>
            </div>
         </div>
         

      </div>

      <FullscreenWrapper 
         title="Contacts & Calls" 
         className="flex-1 min-h-0"
         actionNode={
            <DebouncedSearch 
              onSearch={setSearchQuery} 
              placeholder="Search by name, phone, or tags..." 
              className="w-72"
            />
         }
      >
         <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b text-muted-foreground">
               <tr>
                 <th className="h-12 px-6 font-medium">Name</th>
                 <th className="h-12 px-6 font-medium">Phone</th>
                 <th className="h-12 px-6 font-medium">Tags / Tweaks</th>
                 <th className="h-12 px-6 font-medium">Call Status</th>
                 <th className="h-12 px-6 font-medium">Duration</th>
                 <th className="h-12 px-6 font-medium text-right">Action</th>
               </tr>
            </thead>
            <tbody>
               {(campaign.campaignContacts || [])
                 .filter(cc => {
                   if (!searchQuery) return true;
                   const q = searchQuery.toLowerCase();
                   const name = (cc.overrides?.name || cc.contact.name || '').toLowerCase();
                   const phone = (cc.contact.phone || '').toLowerCase();
                   const tag = (cc.overrides?.tag || '').toLowerCase();
                   return name.includes(q) || phone.includes(q) || tag.includes(q);
                 })
                 .map(cc => {
                 const contact = cc.contact;
                 const log = campaign.callLogs?.find(l => l.contactId === contact.id);
                 return (
                   <tr key={cc.id} className="border-b transition-colors hover:bg-muted/50">
                      <td className="p-6 font-medium">{cc.overrides?.name || contact.name}</td>
                      <td className="p-6 font-mono text-xs text-muted-foreground">{contact.phone}</td>
                      <td className="p-6">
                         {cc.overrides?.goals && (
                            <span className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700 mr-1">Design Auto-Override</span>
                         )}
                         {cc.overrides?.dataToCollect && (
                            <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-700 mr-1">Questions Overridden</span>
                         )}
                         {cc.overrides?.tag && (
                            <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase bg-secondary text-secondary-foreground">{cc.overrides.tag}</span>
                         )}
                      </td>
                      <td className="p-6">
                         {log ? (
                           <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                             log.status === 'completed' ? 'border-transparent bg-primary text-primary-foreground' : 
                             log.status === 'failed' || log.status === 'cancelled' ? 'border-transparent bg-destructive text-destructive-foreground' : 
                             'border-transparent bg-secondary text-secondary-foreground'
                           }`}>
                             {log.status}
                           </span>
                         ) : <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize border-transparent bg-secondary text-secondary-foreground">No call</span>}
                      </td>
                      <td className="p-6 text-muted-foreground">{log?.durationMs ? `${Math.round(log.durationMs/1000)}s` : '-'}</td>
                      <td className="p-6 text-right">
                        {log && (
                          <Link to={`/campaign/${id}/calls/${log.id}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 border border-input bg-background hover:bg-accent hover:text-accent-foreground">View Transcript</Link>
                        )}
                      </td>
                   </tr>
                 )
               })}
               {campaign.campaignContacts?.length > 0 && 
                 campaign.campaignContacts.filter(cc => {
                   if (!searchQuery) return true;
                   const q = searchQuery.toLowerCase();
                   const name = (cc.overrides?.name || cc.contact.name || '').toLowerCase();
                   const phone = (cc.contact.phone || '').toLowerCase();
                   const tag = (cc.overrides?.tag || '').toLowerCase();
                   return name.includes(q) || phone.includes(q) || tag.includes(q);
                 }).length === 0 && (
                 <tr>
                   <td colSpan="6" className="p-8 text-center text-muted-foreground">No matching contacts found.</td>
                 </tr>
               )}
            </tbody>
         </table>
      </FullscreenWrapper>
      
      <button
        onClick={() => setIsSandboxOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium h-10 px-5 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors shrink-0 max-w-fit"
      >
        <Volume2 size={16} /> Open AI Sandbox
      </button>

      <Modal
        isOpen={isSandboxOpen}
        onClose={() => setIsSandboxOpen(false)}
        title="UI Sandbox: Live AI Test"
      >
        <SandboxAgent campaign={campaign} />
      </Modal>


    </div>
  );
}
