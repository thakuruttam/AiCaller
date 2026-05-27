import React, { useEffect, useState, useRef } from 'react';
import api from '../api/axios';
import { useParams, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import AudioPlayer from '../components/AudioPlayer';

function parseTranscript(raw) {
  if (!raw) return [];
  const clean = raw.replace(/\[Twilio_SID:[^\]]+\]/g, '').trim();
  const lines = clean.split('\n').filter(l => l.trim());
  const turns = [];
  let currentSpeaker = null;
  let currentText = [];

  const looksLikeAI = (s) => /^(AI|Agent|assistant|system|bot)/i.test(s);

  for (const line of lines) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && colonIdx < 30) {
      const potentialSpeaker = line.substring(0, colonIdx).trim();
      if (potentialSpeaker && !potentialSpeaker.includes(' ') || potentialSpeaker.split(' ').length <= 3) {
        if (currentSpeaker !== null) {
          turns.push({ speaker: currentSpeaker, text: currentText.join(' ').trim(), isAI: looksLikeAI(currentSpeaker) });
        }
        currentSpeaker = potentialSpeaker;
        currentText = [line.substring(colonIdx + 1).trim()];
        continue;
      }
    }
    if (currentSpeaker !== null) {
      currentText.push(line.trim());
    } else {
      turns.push({ speaker: 'Unknown', text: line.trim(), isAI: false });
    }
  }
  if (currentSpeaker !== null && currentText.length) {
    turns.push({ speaker: currentSpeaker, text: currentText.join(' ').trim(), isAI: looksLikeAI(currentSpeaker) });
  }
  return turns.length > 0 ? turns : [{ speaker: 'Transcript', text: clean, isAI: false, raw: true }];
}

function WaveformBars({ progress = 0.5 }) {
  const bars = Array.from({ length: 60 }, (_, i) => {
    const h = 15 + Math.abs(Math.sin(i * 0.4) * 50) + Math.abs(Math.cos(i * 0.7) * 20);
    return { h: Math.min(h, 90), active: i / 60 < progress };
  });
  return (
    <div className="flex items-end gap-[2px] h-24 overflow-hidden">
      {bars.map((b, i) => (
        <div
          key={i}
          style={{ height: `${b.h}%`, width: '2px', background: b.active ? '#c3c0ff' : '#464555', transition: 'height 0.2s ease' }}
        />
      ))}
    </div>
  );
}

const CallDetails = () => {
  const { campaignId, id } = useParams();
  const { addToast } = useToast();
  const [callLog, setCallLog] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastRetryTime, setLastRetryTime] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchCallDetails(); }, [id]);

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

  const cleanTranscript = (raw) => (raw || '').replace(/\[Twilio_SID:[^\]]+\]/g, '').trim();

  const handleCopyTranscript = async () => {
    if (!callLog?.transcript) return;
    await navigator.clipboard.writeText(cleanTranscript(callLog.transcript));
    setCopied(true);
    addToast("Transcript copied!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTranscript = () => {
    if (!callLog?.transcript) return;
    const name = callLog.contact?.name?.replace(/\s+/g, '_') || 'contact';
    const filename = `transcript_${name}_${callLog.id.split('-')[0]}.txt`;
    const blob = new Blob([cleanTranscript(callLog.transcript)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#777587]">Loading call details...</div>
  );
  if (!callLog) return (
    <div className="flex items-center justify-center h-64 text-[#777587]">Call log not found.</div>
  );

  const contactName = callLog.contact?.name || 'Unknown';
  const campaignName = callLog.campaign?.name || 'Unknown Campaign';
  const durationMs = callLog.durationMs || 0;
  const durationStr = durationMs
    ? `${Math.floor(durationMs / 60000)}m ${Math.round((durationMs % 60000) / 1000)}s`
    : '—';
  const callDate = callLog.createdAt
    ? new Date(callLog.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

  const statusColor = callLog.status === 'completed'
    ? 'bg-emerald-50 text-emerald-700'
    : callLog.status === 'failed'
      ? 'bg-[#ffdad6] text-[#ba1a1a]'
      : callLog.status === 'in-progress'
        ? 'bg-amber-50 text-amber-700'
        : 'bg-zinc-100 text-zinc-600';

  const turns = parseTranscript(callLog.transcript);

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusColor}`} style={{fontFamily:'JetBrains Mono, monospace'}}>
              <span className="material-symbols-outlined text-[14px]" style={{fontVariationSettings:"'FILL' 1"}}>
                {callLog.status === 'completed' ? 'check_circle' : callLog.status === 'failed' ? 'cancel' : 'radio_button_checked'}
              </span>
              {callLog.status ? callLog.status.charAt(0).toUpperCase() + callLog.status.slice(1) : 'Pending'}
            </span>
            <span className="text-[#777587] text-xs" style={{fontFamily:'JetBrains Mono, monospace'}}>
              ID: {callLog.id?.substring(0, 12).toUpperCase() || '—'}
            </span>
          </div>
          <h2 className="text-3xl font-semibold text-[#1b1b24] tracking-tight">Call Details: {contactName}</h2>
        </div>
        <div className="flex gap-3">
          <Link
            to={`/campaigns/${campaignId || callLog.campaignId}`}
            className="flex items-center gap-2 px-4 py-2 border border-zinc-300 text-[#1b1b24] text-sm rounded hover:bg-zinc-50 transition-all"
            style={{fontFamily:'JetBrains Mono, monospace'}}
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back to Campaign
          </Link>
          <Link
            to={`/campaign/${campaignId || callLog.campaignId}/calls/${id}/report`}
            className="flex items-center gap-2 px-4 py-2 bg-[#3525cd] text-white text-sm rounded hover:bg-[#4f46e5] transition-all shadow-sm"
            style={{fontFamily:'JetBrains Mono, monospace'}}
          >
            <span className="material-symbols-outlined text-[20px]">analytics</span>
            View Report
          </Link>
        </div>
      </div>

      {/* Info Strip */}
      <div className="grid grid-cols-4 bg-white border border-zinc-200 rounded-lg p-6 mb-8">
        <div className="space-y-1 border-r border-zinc-100 pr-6">
          <p className="text-xs text-zinc-500 uppercase tracking-tighter" style={{fontFamily:'JetBrains Mono, monospace'}}>Contact Info</p>
          <p className="text-sm font-medium text-[#1b1b24]" style={{fontFamily:'JetBrains Mono, monospace'}}>{callLog.contact?.phone || '—'}</p>
          <p className="text-sm text-zinc-600">{contactName}</p>
        </div>
        <div className="space-y-1 border-r border-zinc-100 px-6">
          <p className="text-xs text-zinc-500 uppercase tracking-tighter" style={{fontFamily:'JetBrains Mono, monospace'}}>Campaign</p>
          <p className="text-sm font-medium text-[#1b1b24]" style={{fontFamily:'JetBrains Mono, monospace'}}>{campaignName}</p>
          <p className="text-sm text-zinc-600 capitalize">{callLog.status || '—'}</p>
        </div>
        <div className="space-y-1 border-r border-zinc-100 px-6">
          <p className="text-xs text-zinc-500 uppercase tracking-tighter" style={{fontFamily:'JetBrains Mono, monospace'}}>Call Timing</p>
          <p className="text-sm font-medium text-[#1b1b24]" style={{fontFamily:'JetBrains Mono, monospace'}}>{callDate}</p>
          <p className="text-sm text-zinc-600">Duration: {durationStr}</p>
        </div>
        <div className="space-y-1 pl-6">
          <p className="text-xs text-zinc-500 uppercase tracking-tighter" style={{fontFamily:'JetBrains Mono, monospace'}}>AI Outcome</p>
          <p className="text-sm font-bold text-[#3525cd]" style={{fontFamily:'JetBrains Mono, monospace'}}>
            {callLog.status === 'completed' ? 'Call Completed' : callLog.status === 'failed' ? 'Call Failed' : 'In Progress'}
          </p>
          <p className="text-sm text-zinc-600">Status: {callLog.status || '—'}</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          {/* Audio Card */}
          <div className="bg-[#18181b] text-white rounded-lg p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3525cd] to-[#c3c0ff]" />
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-sm font-medium flex items-center gap-2" style={{fontFamily:'JetBrains Mono, monospace'}}>
                <span className="material-symbols-outlined text-[#c3c0ff]">graphic_eq</span>
                Call Recording
              </h3>
              <span className="text-sm text-zinc-400" style={{fontFamily:'JetBrains Mono, monospace'}}>{durationStr}</span>
            </div>
            <WaveformBars progress={0.45} />
            {callLog.recordingUrl ? (
              <div className="mt-6">
                <AudioPlayer src={callLog.recordingUrl} />
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-center gap-4">
                <p className="text-sm italic text-zinc-400">No recording found for this call.</p>
                {callLog.status === 'completed' && (
                  <button
                    onClick={handleRetryFetch}
                    disabled={isRetrying}
                    className="px-4 py-2 border border-zinc-600 rounded text-sm text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    style={{fontFamily:'JetBrains Mono, monospace'}}
                  >
                    {isRetrying ? 'Syncing...' : 'Sync from Twilio'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Sentiment Card */}
          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h3 className="text-sm font-medium text-[#1b1b24] mb-4" style={{fontFamily:'JetBrains Mono, monospace'}}>Sentiment &amp; Insights</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">Caller Sentiment</span>
                <span className="text-xs font-medium text-emerald-600" style={{fontFamily:'JetBrains Mono, monospace'}}>Positive</span>
              </div>
              <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[72%]" />
              </div>
              <div className="pt-2">
                <p className="text-xs text-zinc-500 mb-2 uppercase tracking-tighter" style={{fontFamily:'JetBrains Mono, monospace'}}>Keywords Detected</p>
                <div className="flex flex-wrap gap-2">
                  {['Call', 'Campaign', 'Outreach'].map(kw => (
                    <span key={kw} className="bg-zinc-100 text-zinc-700 px-2 py-1 rounded text-xs" style={{fontFamily:'JetBrains Mono, monospace'}}>{kw}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Transcript */}
        <div className="col-span-12 lg:col-span-7">
          <div className="bg-white border border-zinc-200 rounded-lg flex flex-col" style={{minHeight: '600px'}}>
            {/* Transcript Header */}
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-zinc-400">description</span>
                <h3 className="text-sm font-medium text-[#1b1b24]" style={{fontFamily:'JetBrains Mono, monospace'}}>Transcript</h3>
              </div>
              {callLog.transcript && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyTranscript}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-zinc-200 rounded hover:bg-zinc-50 transition-all text-xs"
                    style={{fontFamily:'JetBrains Mono, monospace'}}
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={handleDownloadTranscript}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-zinc-200 rounded hover:bg-zinc-50 transition-all text-xs"
                    style={{fontFamily:'JetBrains Mono, monospace'}}
                  >
                    <span className="material-symbols-outlined text-[16px]">file_download</span>
                    Download
                  </button>
                </div>
              )}
            </div>

            {/* Transcript Body */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-zinc-50/30">
              {callLog.transcript ? (
                turns.map((turn, i) => {
                  if (turn.raw) {
                    return (
                      <div key={i} className="text-sm text-[#464555] whitespace-pre-line leading-relaxed">
                        {turn.text}
                      </div>
                    );
                  }
                  if (turn.isAI) {
                    return (
                      <div key={i} className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#3525cd] flex-shrink-0 flex items-center justify-center text-white">
                          <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                        </div>
                        <div className="space-y-1 max-w-[85%]">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[#1b1b24]" style={{fontFamily:'JetBrains Mono, monospace'}}>{turn.speaker}</span>
                          </div>
                          <div className="bg-white border border-zinc-200 p-4 rounded-r-lg rounded-bl-lg text-sm text-[#464555] leading-relaxed">
                            {turn.text}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={i} className="flex gap-4 flex-row-reverse">
                      <div className="w-10 h-10 rounded-full bg-zinc-800 flex-shrink-0 flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-[20px]">person</span>
                      </div>
                      <div className="space-y-1 max-w-[85%] text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-sm font-medium text-[#1b1b24]" style={{fontFamily:'JetBrains Mono, monospace'}}>{turn.speaker}</span>
                        </div>
                        <div className="bg-zinc-800 text-white p-4 rounded-l-lg rounded-br-lg text-sm leading-relaxed text-left">
                          {turn.text}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-zinc-400 italic">
                  No transcript available for this call.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallDetails;
