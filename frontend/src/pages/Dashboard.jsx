import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Link } from 'react-router-dom';
import { PhoneOutgoing, CheckCircle, Clock, Activity, RefreshCw } from 'lucide-react';
import RoleGate from '../components/RoleGate';
import DebouncedSearch from '../components/DebouncedSearch';
import FullscreenWrapper from '../components/FullscreenWrapper';

const EVAL_BASE = 'http://localhost:4000';

const Dashboard = () => {
  const [campaigns, setCampaigns] = useState([]);
  const [evalProgress, setEvalProgress] = useState({ total: 0, completed: 0, failed: 0, inProgress: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const resCampaigns = await api.get('/api/campaigns');
      const campaignsData = resCampaigns.data;
      
      // Fetch progress only for campaigns the user has access to
      const progressPromises = campaignsData.map(c => 
        api.get(`${EVAL_BASE}/reports/campaign/${c.id}/progress`)
           .catch(() => ({ data: { total: 0, completed: 0, failed: 0, inProgress: 0 } }))
      );
      
      const progressResults = await Promise.all(progressPromises);
      const aggregatedProgress = progressResults.reduce((acc, curr) => {
         acc.total += curr.data.total || 0;
         acc.completed += curr.data.completed || 0;
         acc.failed += curr.data.failed || 0;
         acc.inProgress += curr.data.inProgress || 0;
         return acc;
      }, { total: 0, completed: 0, failed: 0, inProgress: 0 });

      setCampaigns(campaignsData);
      setEvalProgress(aggregatedProgress);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching campaigns', error);
      if (campaigns.length === 0) {
        setCampaigns([
          {
            id: 'mock-1', name: 'Loan Follow-up Campaign (Mock)',
            campaignContacts: [
              { contactId: 'c1', contact: { id: 'c1', name: 'John Doe', phone: '+1234567890' } },
              { contactId: 'c2', contact: { id: 'c2', name: 'Alice Smith', phone: '+1987654321' } }
            ],
            callLogs: [
              { id: 'l1', contactId: 'c1', status: 'completed', durationMs: 4500, transcript: 'User agreed to callback' },
              { id: 'l2', contactId: 'c2', status: 'queued', durationMs: null, transcript: null }
            ]
          }
        ]);
        setLoading(false);
      }
    }
  };

  const getStats = () => {
    let total = 0;
    let completed = 0;
    campaigns.forEach(c => {
      if (c.callLogs) {
        total += c.callLogs.length;
        completed += c.callLogs.filter(log => log.status === 'completed').length;
      }
    });
    return { total, completed };
  };

  const stats = getStats();

  const badgeClass = (status) => {
    const base = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ";
    if (status === 'completed') return base + "border-transparent bg-primary text-primary-foreground";
    if (status === 'queued') return base + "border-transparent bg-secondary text-secondary-foreground";
    if (status === 'failed' || status === 'cancelled') return base + "border-transparent bg-destructive text-destructive-foreground";
    if (status === 'in-progress') return base + "border-transparent bg-zinc-800 text-zinc-100";
    return base + "border-transparent bg-secondary text-secondary-foreground";
  };

  return (
    <div className="animate-fade-in flex flex-col gap-4 h-full">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground mt-1">Monitor your active pre-recorded AI calling campaigns.</p>
        </div>
        <RoleGate allow={['SUPER_ADMIN', 'ADMIN', 'EDITOR']}>
          <Link to="/create-campaign" className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90">
            + New Campaign
          </Link>
        </RoleGate>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <PhoneOutgoing size={16} className="text-zinc-500" />
            Total Calls Queued
          </div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <CheckCircle size={16} className="text-zinc-500" />
            Completed Calls
          </div>
          <div className="text-2xl font-bold">{stats.completed}</div>
        </div>

        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Clock size={16} className="text-zinc-500" />
            Success Rate
          </div>
          <div className="text-2xl font-bold">
            {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-primary/20 bg-primary/5 shadow-sm p-4 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-base text-primary flex items-center gap-2">
              <Activity size={16} className={evalProgress.inProgress > 0 ? "animate-pulse" : ""} />
              AI Evaluation Pipeline
            </h3>
            <button 
              onClick={fetchCampaigns}
              className="inline-flex items-center justify-center rounded-md w-7 h-7 text-primary hover:bg-primary/10 transition-colors"
              title="Refresh Pipeline Status"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
          <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
            {evalProgress.completed + evalProgress.failed} / {evalProgress.total} Processed
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-background rounded-lg p-3 border border-border">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">In Progress</div>
            <div className="text-xl font-bold text-blue-600">{evalProgress.inProgress}</div>
          </div>
          <div className="bg-background rounded-lg p-3 border border-border">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Completed</div>
            <div className="text-xl font-bold text-green-600">{evalProgress.completed}</div>
          </div>
          <div className="bg-background rounded-lg p-3 border border-border">
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Failed</div>
            <div className="text-xl font-bold text-destructive">{evalProgress.failed}</div>
          </div>
        </div>
      </div>

      <FullscreenWrapper 
        title="Active Campaigns" 
        className="flex-1 min-h-0"
        actionNode={
          <DebouncedSearch 
            onSearch={setSearchQuery} 
            placeholder="Search campaigns..." 
            className="w-64"
          />
        }
      >
        <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 border-b text-muted-foreground">
              <tr>
                <th className="h-12 px-6 font-medium">Name</th>
                <th className="h-12 px-6 font-medium">Type</th>
                <th className="h-12 px-6 font-medium">Contacts</th>
                <th className="h-12 px-6 font-medium">Created</th>
                <th className="h-12 px-6 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {campaigns
                .filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(c => (
                <tr key={c.id} className="border-b transition-colors hover:bg-muted/50">
                  <td className="p-6 font-medium">{c.name}</td>
                  <td className="p-6"><span className={badgeClass('neutral')}>{c.type || 'HR'}</span></td>
                  <td className="p-6">{c.campaignContacts?.length || 0}</td>
                  <td className="p-6 text-muted-foreground">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-'}</td>
                  <td className="p-6 text-right flex justify-end gap-2">
                    <Link to={`/edit-campaign/${c.id}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground">Edit</Link>
                    <Link to={`/campaigns/${c.id}/report`} className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground">Report</Link>
                    <Link to={`/campaigns/${c.id}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90">View Details</Link>
                  </td>
                </tr>
              ))}
              {campaigns.length > 0 && campaigns.filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                 <tr>
                    <td colSpan="5" className="p-8 text-center text-muted-foreground">No matching campaigns found.</td>
                 </tr>
              )}
            </tbody>
          </table>
      </FullscreenWrapper>

    </div>
  );
};

export default Dashboard;
