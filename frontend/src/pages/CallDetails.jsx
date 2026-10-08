import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button, PageHeader, StatusBadge, Badge, EmptyState } from '../components/ui';
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
          className={`w-[2px] transition-[height] duration-200 ${b.active ? 'bg-brand-500' : 'bg-paper-700 dark:bg-ink-500'}`}
          style={{ height: `${b.h}%` }}
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
    <EmptyState icon="call" title="Call log not found" body="It may have been removed, or the link is wrong." />
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

  const campaignPath = `/campaigns/${campaignId || callLog.campaignId}`;

  return (
    <div className="page-gutter pt-5 pb-10 animate-fade-in">
      <PageHeader
        back={{ to: campaignPath, label: 'Back to Campaign' }}
        eyebrow={
          <span className="inline-flex items-center gap-3">
            <StatusBadge status={callLog.status || 'pending'} />
            <span>ID: {callLog.id?.substring(0, 12).toUpperCase() || '—'}</span>
          </span>
        }
        title={`Call Details: ${contactName}`}
        actions={
          <Button
            as={Link}
            to={`/campaign/${campaignId || callLog.campaignId}/calls/${id}/report`}
            icon="analytics"
          >
            View Report
          </Button>
        }
      />

      {/* Info Strip */}
      <div className="bg-card dark:bg-muted rounded-2xl shadow-primary grid grid-cols-4 p-5 mb-7">
        <div className="space-y-1 border-r border-border pr-6">
          <p className="text-xs text-muted-foreground">Contact Info</p>
          <p className="text-sm font-medium text-foreground tabular-nums">{callLog.contact?.phone || '—'}</p>
          <p className="text-sm text-muted-foreground">{contactName}</p>
        </div>
        <div className="space-y-1 border-r border-border px-6">
          <p className="text-xs text-muted-foreground">Campaign</p>
          <p className="text-sm font-medium text-foreground">{campaignName}</p>
          <p className="text-sm text-muted-foreground capitalize">{callLog.status || '—'}</p>
        </div>
        <div className="space-y-1 border-r border-border px-6">
          <p className="text-xs text-muted-foreground">Call Timing</p>
          <p className="text-sm font-medium text-foreground">{callDate}</p>
          <p className="text-sm text-muted-foreground">Duration: {durationStr}</p>
        </div>
        <div className="space-y-1 pl-6">
          <p className="text-xs text-muted-foreground">AI Outcome</p>
          <p className="text-sm font-semibold text-brand-500 dark:text-brand-300">
            {callLog.status === 'completed' ? 'Call Completed' : callLog.status === 'failed' ? 'Call Failed' : 'In Progress'}
          </p>
          <p className="text-sm text-muted-foreground">Status: {callLog.status || '—'}</p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-5 space-y-7">
          {/* Audio Card */}
          <div className="bg-ink-200 text-white rounded-control p-8 shadow-overlay relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-brand-500" />
            <div className="flex justify-between items-center mb-7">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-brand-300">graphic_eq</span>
                Call Recording
              </h3>
              <span className="text-sm text-muted-foreground">{durationStr}</span>
            </div>
            <WaveformBars progress={0.45} />
            {callLog.recordingUrl ? (
              <div className="mt-7">
                <AudioPlayer
                  src={callLog.recordingUrl}
                  onTimeUpdate={(currentTime, duration) => setPlayback({ currentTime, duration: duration || 0 })}
                />
              </div>
            ) : isRetrying ? (
              <div className="mt-7 flex items-center justify-center">
                <p className="text-sm italic text-muted-foreground">Checking for recording…</p>
              </div>
            ) : (
              <div className="mt-7 flex flex-col items-center gap-4">
                <p className="text-sm italic text-muted-foreground">No recording found for this call.</p>
                {callLog.status === 'completed' && (
                  <Button variant="ghost" size="md" onClick={() => syncRecording()} disabled={isRetrying}>Retry Sync</Button>
                )}
              </div>
            )}
          </div>

          {/* Sentiment Card */}
          <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Sentiment &amp; Insights</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Caller Sentiment</span>
                <span className="text-xs font-medium text-positive-dim">Positive</span>
              </div>
              <div className="w-full bg-paper-400 dark:bg-ink-300 h-2 rounded-full overflow-hidden">
                <div className="bg-positive h-full w-[72%]" />
              </div>
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2">Keywords Detected</p>
                <div className="flex flex-wrap gap-2">
                  {['Call', 'Campaign', 'Outreach'].map(kw => (
                    <Badge key={kw} tone="neutral" dot={false}>{kw}</Badge>
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
            <div className="px-5 py-3.5 border-b border-border flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined [--icon-size:18px] text-muted-foreground">description</span>
                <h3 className="text-sm font-semibold text-foreground">Transcript</h3>
              </div>
              {callLog.transcript && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" icon="content_copy" onClick={handleCopyTranscript}>{copied ? 'Copied' : 'Copy'}</Button>
                  <Button variant="secondary" size="sm" icon="file_download" onClick={handleDownloadTranscript}>Download</Button>
                </div>
              )}
            </div>

            {/* Transcript Body */}
            <div ref={transcriptContainerRef} className="flex-1 overflow-y-auto p-8 space-y-7 bg-paper-200/30 dark:bg-ink-50/30">
              {callLog.transcript ? (
                turns.map((turn, i) => {
                  const isActive = i === activeTurnIndex;
                  if (turn.raw) {
                    return (
                      <div
                        key={i}
                        ref={el => turnRefs.current[i] = el}
                        className={`text-sm text-muted-foreground whitespace-pre-line leading-relaxed transition-colors duration-100 rounded-control p-2 ${isActive ? 'bg-caution dark:bg-caution/30' : 'bg-transparent'}`}
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
                            <span className="text-sm font-medium text-foreground">{turn.speaker}</span>
                          </div>
                          <div className={`border p-4 rounded-r-xl rounded-bl-xl text-sm text-foreground leading-relaxed transition-colors duration-100 ${isActive ? 'bg-caution/10 border-caution/25' : 'bg-paper-200 dark:bg-white/[0.04] border-border'}`}>
                            {turn.text}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={i} ref={el => turnRefs.current[i] = el} className="flex gap-4 flex-row-reverse">
                      <div className="w-10 h-10 rounded-full bg-paper-400 dark:bg-white/10 flex-shrink-0 flex items-center justify-center text-muted-foreground">
                        <span className="material-symbols-outlined text-[20px]">person</span>
                      </div>
                      <div className="space-y-1 max-w-[85%] text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-sm font-medium text-foreground">{turn.speaker}</span>
                        </div>
                        <div className={`border p-4 rounded-l-xl rounded-br-xl text-sm leading-relaxed text-left text-foreground transition-colors duration-100 ${isActive ? 'bg-caution/10 border-caution/25' : 'bg-brand-500/10 border-brand-500/25'}`}>
                          {turn.text}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground italic">
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
