import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button, IconButton } from '../components/ui';
import api from '../api/axios';
import { useParams, Link } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import AudioPlayer from '../components/AudioPlayer';
import PageLoader from '../components/PageLoader';

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
          style={{ height: `${b.h}%`, width: '2px', background: b.active ? '#94b9ff' : '#505967', transition: 'height 0.2s ease' }}
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
  const autoSyncedRef = useRef(false);
  // No per-line timestamps exist anywhere (transcript is saved as plain
  // SPEAKER: text blocks server-side, no timing metadata). Real word-level
  // sync would need that captured at STT time. Approximate instead: assume
  // each turn's speaking time is proportional to its character length,
  // spread across the recording's total duration.
  const [playback, setPlayback] = useState({ currentTime: 0, duration: 0 });
  const turnRefs = useRef([]);
  const transcriptContainerRef = useRef(null);

  const turns = useMemo(() => parseTranscript(callLog?.transcript), [callLog?.transcript]);

  const turnTimings = useMemo(() => {
    if (!turns.length || !playback.duration) return [];
    const lengths = turns.map(t => Math.max((t.text || '').length, 1));
    const total = lengths.reduce((a, b) => a + b, 0);
    let acc = 0;
    return turns.map((t, i) => {
      const start = (acc / total) * playback.duration;
      acc += lengths[i];
      const end = (acc / total) * playback.duration;
      return { start, end };
    });
  }, [turns, playback.duration]);

  const activeTurnIndex = useMemo(() => {
    if (!turnTimings.length) return -1;
    const idx = turnTimings.findIndex(t => playback.currentTime >= t.start && playback.currentTime < t.end);
    if (idx !== -1) return idx;
    return playback.currentTime > 0 ? turnTimings.length - 1 : -1;
  }, [turnTimings, playback.currentTime]);

  useEffect(() => {
    if (activeTurnIndex < 0) return;
    const container = transcriptContainerRef.current;
    const el = turnRefs.current[activeTurnIndex];
    if (!container || !el) return;
    // Scroll only the transcript panel's own scroll container — el.scrollIntoView()
    // walks up EVERY scrollable ancestor including the page itself, which was
    // dragging the whole screen along instead of just moving the transcript.
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const delta = (elRect.top - containerRect.top) - (container.clientHeight / 2 - elRect.height / 2);
    container.scrollBy({ top: delta, behavior: 'smooth' });
  }, [activeTurnIndex]);

  useEffect(() => { autoSyncedRef.current = false; fetchCallDetails(); }, [id]);

  const fetchCallDetails = async () => {
    try {
      const res = await api.get(`/api/campaigns/calls/${id}`);
      setCallLog(res.data);
      // Recording usually lands via telephony-gateway's webhook right after the
      // call ends, but that can occasionally lag or miss — proactively check
      // with Plivo once on load instead of making the user click Sync.
      if (res.data.status === 'completed' && !res.data.recordingUrl && !autoSyncedRef.current) {
        autoSyncedRef.current = true;
        syncRecording({ silent: true });
      }
    } catch (error) {
      console.error('Error fetching call details', error);
    } finally {
      setLoading(false);
    }
  };

  const syncRecording = async ({ silent = false } = {}) => {
    if (!silent && lastRetryTime && Date.now() - lastRetryTime < 60000) {
      addToast(`Please wait ${Math.ceil((60000 - (Date.now() - lastRetryTime)) / 1000)} seconds before retrying.`, "warning");
      return;
    }
    setIsRetrying(true);
    setLastRetryTime(Date.now());
    try {
      const res = await api.post(`/api/campaigns/calls/${id}/fetch-recording`);
      setCallLog(res.data);
      if (!silent) addToast("Recording synced successfully!", "success");
    } catch (error) {
      if (!silent) addToast(error.response?.data?.error || "Error retrying", "error");
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

  if (loading) return <PageLoader text="Loading call details…" />;
  if (!callLog) return (
    <div className="flex items-center justify-center h-64 text-ink-700 dark:text-ink-900">Call log not found.</div>
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
    ? 'bg-positive/10 text-positive-dim dark:bg-positive/15 dark:text-positive'
    : callLog.status === 'failed'
      ? 'bg-negative/10 text-negative-dim dark:bg-negative/15 dark:text-negative'
      : callLog.status === 'in-progress'
        ? 'bg-caution/10 text-caution-dim dark:bg-caution/15 dark:text-caution'
        : 'bg-paper-400 text-ink-600 dark:bg-ink-300 dark:text-ink-900';

  return (
    <div className="page-gutter pt-3 pb-7 animate-fade-in">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusColor}`}>
              <span className="material-symbols-outlined text-[14px]" style={{fontVariationSettings:"'FILL' 1"}}>
                {callLog.status === 'completed' ? 'check_circle' : callLog.status === 'failed' ? 'cancel' : 'radio_button_checked'}
              </span>
              {callLog.status ? callLog.status.charAt(0).toUpperCase() + callLog.status.slice(1) : 'Pending'}
            </span>
            <span className="text-ink-700 dark:text-ink-900 text-xs">
              ID: {callLog.id?.substring(0, 12).toUpperCase() || '—'}
            </span>
          </div>
          <h2 className="text-[22px] font-semibold text-ink-100 dark:text-paper-200">Call Details: {contactName}</h2>
        </div>
        <div className="flex gap-3">
          <Link
            to={`/campaigns/${campaignId || callLog.campaignId}`}
            className="flex items-center gap-2 px-4 py-2 border border-paper-600 dark:border-ink-400 text-ink-100 dark:text-paper-200 text-sm rounded hover:bg-paper-200 dark:hover:bg-ink-400/50 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            Back to Campaign
          </Link>
          <Link
            to={`/campaign/${campaignId || callLog.campaignId}/calls/${id}/report`}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white text-sm rounded hover:bg-brand-600 transition-all shadow-card"
          >
            <span className="material-symbols-outlined text-[20px]">analytics</span>
            View Report
          </Link>
        </div>
      </div>

      {/* Info Strip */}
      <div className="bg-card dark:bg-muted rounded-2xl shadow-primary grid grid-cols-4 p-6 mb-8">
        <div className="space-y-1 border-r border-paper-400 dark:border-ink-400/50 pr-6">
          <p className="text-xs text-ink-700 dark:text-ink-900 ">Contact Info</p>
          <p className="text-sm font-medium text-ink-100 dark:text-paper-200">{callLog.contact?.phone || '—'}</p>
          <p className="text-sm text-ink-600 dark:text-ink-900">{contactName}</p>
        </div>
        <div className="space-y-1 border-r border-paper-400 dark:border-ink-400/50 px-6">
          <p className="text-xs text-ink-700 dark:text-ink-900 ">Campaign</p>
          <p className="text-sm font-medium text-ink-100 dark:text-paper-200">{campaignName}</p>
          <p className="text-sm text-ink-600 dark:text-ink-900 capitalize">{callLog.status || '—'}</p>
        </div>
        <div className="space-y-1 border-r border-paper-400 dark:border-ink-400/50 px-6">
          <p className="text-xs text-ink-700 dark:text-ink-900 ">Call Timing</p>
          <p className="text-sm font-medium text-ink-100 dark:text-paper-200">{callDate}</p>
          <p className="text-sm text-ink-600 dark:text-ink-900">Duration: {durationStr}</p>
        </div>
        <div className="space-y-1 pl-6">
          <p className="text-xs text-ink-700 dark:text-ink-900 ">AI Outcome</p>
          <p className="text-sm font-bold text-brand-500">
            {callLog.status === 'completed' ? 'Call Completed' : callLog.status === 'failed' ? 'Call Failed' : 'In Progress'}
          </p>
          <p className="text-sm text-ink-600 dark:text-ink-900">Status: {callLog.status || '—'}</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          {/* Audio Card */}
          <div className="bg-ink-200 text-white rounded-control p-8 shadow-overlay relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-500 to-brand-300" />
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-brand-300">graphic_eq</span>
                Call Recording
              </h3>
              <span className="text-sm text-ink-800">{durationStr}</span>
            </div>
            <WaveformBars progress={0.45} />
            {callLog.recordingUrl ? (
              <div className="mt-6">
                <AudioPlayer
                  src={callLog.recordingUrl}
                  onTimeUpdate={(currentTime, duration) => setPlayback({ currentTime, duration: duration || 0 })}
                />
              </div>
            ) : isRetrying ? (
              <div className="mt-6 flex items-center justify-center">
                <p className="text-sm italic text-ink-800">Checking for recording…</p>
              </div>
            ) : (
              <div className="mt-6 flex flex-col items-center gap-4">
                <p className="text-sm italic text-ink-800">No recording found for this call.</p>
                {callLog.status === 'completed' && (
                  <Button variant="ghost" size="md" onClick={() => syncRecording()} disabled={isRetrying}>Retry Sync</Button>
                )}
              </div>
            )}
          </div>

          {/* Sentiment Card */}
          <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-6">
            <h3 className="text-sm font-semibold text-ink-100 dark:text-paper-200 mb-4">Sentiment &amp; Insights</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-600 dark:text-ink-900">Caller Sentiment</span>
                <span className="text-xs font-medium text-positive-dim">Positive</span>
              </div>
              <div className="w-full bg-paper-400 dark:bg-ink-300 h-2 rounded-full overflow-hidden">
                <div className="bg-positive h-full w-[72%]" />
              </div>
              <div className="pt-2">
                <p className="text-xs text-ink-700 dark:text-ink-900 mb-2 ">Keywords Detected</p>
                <div className="flex flex-wrap gap-2">
                  {['Call', 'Campaign', 'Outreach'].map(kw => (
                    <span key={kw} className="bg-paper-400 dark:bg-ink-300 text-ink-500 dark:text-ink-900 px-2 py-1 rounded text-xs">{kw}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Transcript */}
        <div className="col-span-12 lg:col-span-7">
          <div className="bg-card dark:bg-muted rounded-2xl shadow-primary flex flex-col" style={{height: 'calc(100vh - 220px)', maxHeight: '800px'}}>
            {/* Transcript Header */}
            <div className="p-4 border-b border-paper-400 dark:border-ink-400 flex justify-between items-center bg-paper-200/50 dark:bg-ink-50/50">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-ink-800 dark:text-ink-800">description</span>
                <h3 className="text-sm font-semibold text-ink-100 dark:text-paper-200">Transcript</h3>
              </div>
              {callLog.transcript && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" icon="content_copy" onClick={handleCopyTranscript}>{copied ? 'Copied' : 'Copy'}</Button>
                  <Button variant="secondary" size="sm" icon="file_download" onClick={handleDownloadTranscript}>Download</Button>
                </div>
              )}
            </div>

            {/* Transcript Body */}
            <div ref={transcriptContainerRef} className="flex-1 overflow-y-auto p-8 space-y-8 bg-paper-200/30 dark:bg-ink-50/30">
              {callLog.transcript ? (
                turns.map((turn, i) => {
                  const isActive = i === activeTurnIndex;
                  if (turn.raw) {
                    return (
                      <div
                        key={i}
                        ref={el => turnRefs.current[i] = el}
                        className={`text-sm text-ink-600 dark:text-ink-900 whitespace-pre-line leading-relaxed transition-colors duration-100 rounded-control p-2 ${isActive ? 'bg-caution dark:bg-caution/30' : 'bg-transparent'}`}
                      >
                        {turn.text}
                      </div>
                    );
                  }
                  if (turn.isAI) {
                    return (
                      <div key={i} ref={el => turnRefs.current[i] = el} className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-brand-500 flex-shrink-0 flex items-center justify-center text-white">
                          <span className="material-symbols-outlined text-[20px]">smart_toy</span>
                        </div>
                        <div className="space-y-1 max-w-[85%]">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ink-100 dark:text-paper-200">{turn.speaker}</span>
                          </div>
                          <div className={`border p-4 rounded-r-lg rounded-bl-lg text-sm text-ink-600 dark:text-ink-900 dark:text-ink-900 leading-relaxed transition-colors duration-100 ${isActive ? 'bg-caution dark:bg-caution/30 border-caution' : 'bg-paper-100 dark:bg-ink-300 border-paper-500 dark:border-ink-400'}`}>
                            {turn.text}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={i} ref={el => turnRefs.current[i] = el} className="flex gap-4 flex-row-reverse">
                      <div className="w-10 h-10 rounded-full bg-ink-300 flex-shrink-0 flex items-center justify-center text-white">
                        <span className="material-symbols-outlined text-[20px]">person</span>
                      </div>
                      <div className="space-y-1 max-w-[85%] text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-sm font-medium text-ink-100 dark:text-paper-200">{turn.speaker}</span>
                        </div>
                        <div className={`p-4 rounded-l-lg rounded-br-lg text-sm leading-relaxed text-left transition-colors duration-100 ${isActive ? 'bg-caution dark:bg-caution/30 text-ink-100' : 'bg-ink-300 text-white'}`}>
                          {turn.text}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-ink-800 dark:text-ink-800 italic">
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
