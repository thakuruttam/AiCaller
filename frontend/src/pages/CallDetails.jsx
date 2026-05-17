import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Phone, User, Info, FileAudio, Calendar, Activity } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import AudioPlayer from '../components/AudioPlayer';
import axios from 'axios';

const CallDetails = () => {
  const { campaignId, id } = useParams();
  const { addToast } = useToast();
  const [callLog, setCallLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastRetryTime, setLastRetryTime] = useState(null);

  useEffect(() => {
    fetchCallDetails();
  }, [id]);

  const fetchCallDetails = async () => {
    try {
      const res = await api.get(`/api/campaigns/calls/${id}`);
      setCallLog(res.data);
    } catch (error) {
      console.error('Error fetching call details', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryFetch = async () => {
    if (lastRetryTime && Date.now() - lastRetryTime < 60000) {
      addToast(`Please wait ${Math.ceil((60000 - (Date.now() - lastRetryTime)) / 1000)} seconds before retrying.`, "warning");
      return;
    }
    setIsRetrying(true);
    setLastRetryTime(Date.now());
    try {
      const res = await api.post(`/api/campaigns/calls/${id}/fetch-recording`);
      setCallLog(res.data);
      addToast("Recording synced successfully!", "success");
    } catch (error) {
       addToast(error.response?.data?.error || "Error retrying", "error");
    } finally {
      setIsRetrying(false);
    }
  };



  if (loading) return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Loading call details...</div>;
  if (!callLog) return <div className="flex items-center justify-center min-h-[400px] text-muted-foreground">Call log not found.</div>;

  return (
    <div className="animate-fade-in flex flex-col gap-6 h-full max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link to={`/campaigns/${campaignId || callLog.campaignId}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 border border-input bg-background hover:bg-zinc-100 transition-colors">
            <ArrowLeft size={16} className="mr-2" /> Back
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">Call Details</h2>
        </div>
        <Link
          to={`/campaign/${campaignId || callLog.campaignId}/calls/${id}/report`}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          View Report
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 shrink-0">
        {/* Contact info card */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-4">
            <User size={14} /> Contact Details
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm text-zinc-500">Name</div>
              <div className="text-lg font-semibold text-zinc-900">{callLog.contact?.name || 'Unknown'}</div>
            </div>
            <div>
              <div className="text-sm text-zinc-500">Phone Number</div>
              <div className="text-lg font-mono text-zinc-900">{callLog.contact?.phone || '-'}</div>
            </div>
          </div>
        </div>

        {/* Campaign info card */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-4">
            <Activity size={14} /> Campaign & Status
          </div>
          
          <div className="space-y-4">
            <div>
              <div className="text-sm text-zinc-500">Campaign</div>
              <div className="text-lg font-semibold text-zinc-900">{callLog.campaign?.name || 'Unknown Campaign'}</div>
            </div>
            <div>
              <div className="text-sm text-zinc-500">Current Status</div>
              <div className="mt-1">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                  callLog.status === 'completed' ? 'border-transparent bg-zinc-900 text-white' : 
                  callLog.status === 'failed' ? 'border-transparent bg-red-600 text-white' : 
                  callLog.status === 'in-progress' ? 'border-transparent bg-blue-600 text-white' : 
                  'border-transparent bg-zinc-100 text-zinc-900'
                }`}>
                  {callLog.status || 'pending'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audio recording card */}
      <div className="rounded-xl border bg-white p-6 shadow-sm shrink-0">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
            <FileAudio size={16} /> Audio Recording
          </h3>
          <span className="flex items-center gap-1 text-xs text-zinc-400 font-mono">
            <Calendar size={12} /> {new Date(callLog.createdAt).toLocaleString()}
          </span>
        </div>
        
        {callLog.recordingUrl ? (
          <div className="space-y-4">
             <AudioPlayer src={callLog.recordingUrl} />
             <div className="text-[10px] text-zinc-400 px-1 truncate">
                Direct URL: <a href={callLog.recordingUrl} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 hover:underline transition-colors">{callLog.recordingUrl}</a>
             </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 bg-zinc-50 rounded-lg border border-dashed border-zinc-200 text-zinc-500">
            <p className="text-sm italic mb-4">No recording found for this call.</p>
            {callLog.status === 'completed' && (
              <button 
                onClick={handleRetryFetch} 
                disabled={isRetrying}
                className="inline-flex items-center justify-center rounded-md text-xs font-medium h-9 px-4 border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors shadow-sm"
              >
                {isRetrying ? 'Syncing...' : 'Sync Recording from Twilio'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Transcript card */}
      <div className="rounded-xl border bg-white p-6 shadow-sm flex flex-col flex-1 min-h-0">
         <div className="flex items-center justify-between mb-4 shrink-0">
           <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-2">Transcript</h3>
         </div>

         <div className="bg-zinc-50 p-6 rounded-lg border border-zinc-100 text-sm leading-relaxed whitespace-pre-line text-zinc-800 overflow-y-auto flex-1">
            {callLog.transcript || <span className="text-zinc-400 italic">No transcript available for this call.</span>}
         </div>
      </div>
    </div>
  );
};

export default CallDetails;
