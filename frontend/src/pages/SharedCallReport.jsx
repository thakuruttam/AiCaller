import React, { useEffect, useState } from 'react';
import { Tabs, Table, THead, Th, TBody, Tr, Td, TableToolbar } from '../components/ui';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../api/config';

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
      if (potentialSpeaker && (!potentialSpeaker.includes(' ') || potentialSpeaker.split(' ').length <= 3)) {
        if (currentSpeaker !== null) {
          turns.push({ speaker: currentSpeaker, text: currentText.join(' ').trim(), isAI: looksLikeAI(currentSpeaker) });
        }
        currentSpeaker = potentialSpeaker;
        currentText = [line.substring(colonIdx + 1).trim()];
        continue;
      }
    }
    if (currentSpeaker !== null) currentText.push(line.trim());
  }
  if (currentSpeaker !== null && currentText.length > 0) {
    turns.push({ speaker: currentSpeaker, text: currentText.join(' ').trim(), isAI: looksLikeAI(currentSpeaker) });
  }
  return turns;
}

const OUTCOME_BADGE = {
  COMPLETED:    "bg-positive/10 text-positive-dim dark:bg-positive/15 dark:text-positive",
  NO_ANSWER:    "bg-paper-400 text-ink-600 dark:bg-ink-300 dark:text-ink-900",
  INCOMPLETE:   "bg-caution/10 text-caution-dim dark:bg-caution/15 dark:text-caution",
  WRONG_PERSON: 'bg-negative/10 text-negative-dim',
  RESCHEDULE:   "bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  BUSY:         "bg-paper-400 text-ink-600 dark:bg-ink-300 dark:text-ink-900",
  FAILED:       "bg-negative/10 text-negative-dim dark:bg-negative/15 dark:text-negative",
};

const SENTIMENT_BADGE = {
  positive: "bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  neutral:  "bg-paper-400 text-ink-500 dark:bg-ink-300 dark:text-ink-900",
  negative: "bg-negative/10 text-negative-dim dark:bg-negative/15 dark:text-negative",
};

const CONFIDENCE_BAR = {
  high:   { color: 'bg-positive', pct: '95%' },
  medium: { color: 'bg-caution/100', pct: '70%' },
  low:    { color: "bg-paper-900 dark:bg-ink-700", pct: "40%" },
};

export default function SharedCallReport() {
  const { token, callLogId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterScore, setFilterScore] = useState('all');

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/share/${token}/calls/${callLogId}`);
        setData(res.data);
      } catch (e) {
        if (e.response?.status === 410) setError('This share link has expired.');
        else if (e.response?.status === 404) setError('Call not found.');
        else setError('Failed to load call report.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, callLogId]);

  useEffect(() => {
    const name = data?.callLog?.contact?.name || data?.report?.contactName;
    document.title = name ? `Call Report — ${name} — AI Caller Pro` : 'Shared Call Report — AI Caller Pro';
  }, [data]);

  if (loading) return (
    <div className="min-h-screen bg-paper-200 dark:bg-ink-50 flex items-center justify-center">
      <div className="text-ink-700 dark:text-ink-900 text-sm">Loading…</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-paper-200 dark:bg-ink-50 flex items-center justify-center">
      <div className="text-center">
        <span className="material-symbols-outlined text-[48px] text-ink-900 dark:text-ink-700 block mb-3">link_off</span>
        <p className="text-ink-600 dark:text-ink-900 font-semibold">{error}</p>
        <Link to={`/share/${token}`} className="text-sm text-brand-500 mt-3 block">← Back to Report</Link>
      </div>
    </div>
  );

  const { callLog, report } = data;
  const turns = parseTranscript(callLog?.transcript);
  const questionResults = report?.reportData?.questionResults || [];
  const completionPercent = report?.completionRate != null ? Math.round(report.completionRate * 100) : null;
  const audioUrl = `${API_BASE}/api/share/${token}/calls/${callLogId}/audio`;

  const filteredQuestions = questionResults.filter(qr => {
    if (filterScore === 'all') return true;
    const max = qr.weight || 0;
    const awarded = qr.questionScore || 0;
    if (max === 0) return true;
    if (filterScore === 'full') return awarded >= max;
    if (filterScore === 'partial') return awarded > 0 && awarded < max;
    if (filterScore === 'failed') return awarded === 0;
    return true;
  });

  return (
    <div className="min-h-screen bg-paper-200 dark:bg-ink-50">
      {/* Header */}
      <header className="bg-ink-100 px-8 py-5 flex items-center gap-4 shadow-card">
        <div className="w-9 h-9 bg-brand-600 rounded flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-white text-[18px]" style={{fontVariationSettings:"'FILL' 1"}}>graphic_eq</span>
        </div>
        <div>
          <h1 className="text-white font-bold text-base leading-tight">AI Caller Pro</h1>
          <p className="text-ink-800 text-xs font-medium ">Shared Call Report</p>
        </div>
      </header>

      <main className="p-10 max-w-[1200px] mx-auto">
        <Link
          to={`/share/${token}`}
          className="flex items-center gap-2 text-ink-600 dark:text-ink-900 hover:text-brand-500 transition-all hover:-translate-x-1 font-bold mb-6 text-sm"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Back to Campaign Report
        </Link>

        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h2 className="text-[22px] font-semibold text-ink-100 dark:text-paper-200 tracking-tight">{callLog?.contact?.name || report?.contactName || 'Unknown'}</h2>
            <p className="text-ink-700 dark:text-ink-900 text-sm mt-0.5">{callLog?.contact?.phone} · {new Date(callLog?.createdAt || report?.createdAt).toLocaleString()}</p>
          </div>
          {callLog?.durationMs && (
            <span className="text-xs bg-paper-400 dark:bg-ink-300 text-ink-600 dark:text-ink-900 px-3 py-1.5 rounded-full shrink-0">
              {Math.round(callLog.durationMs / 1000)}s
            </span>
          )}
        </div>

        {/* Summary KPIs */}
        {report && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-5">
              <p className="text-xs font-medium text-ink-700 dark:text-ink-900 mb-2">Outcome</p>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${OUTCOME_BADGE[report.outcome] || "bg-paper-400 text-ink-600 dark:bg-ink-300 dark:text-ink-900"}`}>
                {(report.outcome || 'Unknown').replace('_', ' ')}
              </span>
            </div>
            <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-5">
              <p className="text-xs font-medium text-ink-700 dark:text-ink-900 mb-2">QA Score</p>
              <p className="text-3xl font-bold text-brand-500">{report.score ?? '—'}<span className="text-ink-800 dark:text-ink-800 text-base font-semibold">/100</span></p>
            </div>
            <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-5">
              <p className="text-xs font-medium text-ink-700 dark:text-ink-900 mb-2">Sentiment</p>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${SENTIMENT_BADGE[report.sentiment] || "bg-paper-400 text-ink-500 dark:bg-ink-300 dark:text-ink-900"}`}>
                {report.sentiment ? report.sentiment.charAt(0).toUpperCase() + report.sentiment.slice(1) : '—'}
              </span>
            </div>
            <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-5">
              <p className="text-xs font-medium text-ink-700 dark:text-ink-900 mb-2">Completion</p>
              <p className="text-3xl font-bold text-ink-100 dark:text-paper-200">{completionPercent != null ? `${completionPercent}%` : '—'}</p>
            </div>
          </section>
        )}

        {/* AI Summary */}
        {report?.reportSummary && (
          <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-brand-500" style={{fontVariationSettings:"'FILL' 1"}}>auto_awesome</span>
              <h3 className="text-sm font-semibold text-ink-100 dark:text-paper-200">AI Summary</h3>
            </div>
            <p className="text-ink-500 dark:text-ink-900 leading-relaxed">{report.reportSummary}</p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* Audio Player */}
          {callLog?.hasRecording && (
            <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-brand-500" style={{fontVariationSettings:"'FILL' 1"}}>mic</span>
                <h3 className="text-sm font-semibold text-ink-100 dark:text-paper-200">Recording</h3>
              </div>
              <audio
                controls
                className="w-full"
                src={audioUrl}
                preload="metadata"
              >
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {/* Transcript */}
          <div className={`bg-card dark:bg-muted rounded-2xl shadow-primary p-6 ${callLog?.hasRecording ? '' : 'xl:col-span-2'}`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-brand-500" style={{fontVariationSettings:"'FILL' 1"}}>chat</span>
              <h3 className="text-sm font-semibold text-ink-100 dark:text-paper-200">Transcript</h3>
            </div>
            {turns.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {turns.map((t, i) => (
                  <div key={i} className={`flex gap-3 ${t.isAI ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${t.isAI ? "bg-brand-600 text-white" : "bg-paper-500 dark:bg-ink-400 text-ink-600 dark:text-ink-900"}`}>
                      {t.isAI ? 'AI' : 'U'}
                    </div>
                    <div className={`px-4 py-2.5 rounded-card max-w-[80%] text-sm leading-relaxed ${t.isAI ? "bg-brand-100 dark:bg-brand-500/15 text-ink-100 dark:text-paper-200 rounded-tl-sm" : "bg-paper-400 dark:bg-ink-300 text-ink-500 dark:text-ink-900 rounded-tr-sm"}`}>
                      {t.text}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-800 dark:text-ink-800 italic">No transcript available.</p>
            )}
          </div>
        </div>

        {/* Evaluation Breakdown */}
        {questionResults.length > 0 && (
          <div className="bg-card dark:bg-muted rounded-2xl shadow-primary overflow-hidden">
            <TableToolbar
              title="Evaluation breakdown"
              count={filteredQuestions.length}
            >
              <Tabs
                size="sm"
                value={filterScore}
                onChange={setFilterScore}
                items={[
                  { value: 'all', label: 'All' },
                  { value: 'full', label: 'Full score' },
                  { value: 'partial', label: 'Partial' },
                  { value: 'failed', label: 'Failed' },
                ]}
              />
            </TableToolbar>
            <Table>
              <THead>
                <Th>Question</Th>
                <Th>Answer</Th>
                <Th>Scoring rule</Th>
                <Th align="right">Points</Th>
              </THead>
              <TBody>
                {filteredQuestions.map(qr => {
                  const max = qr.weight || 0;
                  const awarded = qr.questionScore || 0;
                  const color = max === 0 ? "text-ink-600 dark:text-ink-900" : awarded >= max ? 'text-positive-dim' : awarded === 0 ? 'text-negative-dim' : 'text-caution-dim';
                  const mainRow = qr.breakdownRows?.find(r => r.rule !== 'Field present') || {};
                  const confStr = report?.extractedFields?.[mainRow.field]?.confidence || '—';
                  const conf = CONFIDENCE_BAR[confStr];

                  return (
                    <Tr key={qr.questionId}>
                      <Td className="max-w-xs">
                        <p className="font-medium leading-snug">{qr.questionText || mainRow.questionText || qr.questionId}</p>
                      </Td>
                      <Td>
                        {qr.answerExtracted ? (
                          <div>
                            <p>{qr.answerExtracted}</p>
                            {conf && (
                              <div className="flex items-center gap-2 mt-1">
                                <div className="w-16 h-1 bg-paper-400 dark:bg-ink-300 rounded-full overflow-hidden">
                                  <div className={`h-full ${conf.color} rounded-full`} style={{width: conf.pct}} />
                                </div>
                                <span className="text-[10px] text-muted-foreground uppercase">{confStr}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No answer</span>
                        )}
                      </Td>
                      <Td muted>
                        <span className="text-xs">{mainRow.rule || '—'}</span>
                        {mainRow.reason && <p className="text-xs mt-0.5">{mainRow.reason}</p>}
                      </Td>
                      <Td numeric>
                        <span className={`font-bold ${color}`}>{awarded}/{max}</span>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
