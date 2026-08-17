import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../api/config';
import FullscreenTable, { FullscreenButton } from '../components/FullscreenTable';

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
  COMPLETED:    "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  NO_ANSWER:    "bg-zinc-100 text-zinc-600 dark:bg-slate-700 dark:text-slate-400",
  INCOMPLETE:   "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  WRONG_PERSON: 'bg-[#ffdad6] text-[#ba1a1a]',
  RESCHEDULE:   "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  BUSY:         "bg-zinc-100 text-zinc-600 dark:bg-slate-700 dark:text-slate-400",
  FAILED:       "bg-[#ffdad6] text-[#ba1a1a] dark:bg-red-900/30 dark:text-red-300",
};

const SENTIMENT_BADGE = {
  positive: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  neutral:  "bg-zinc-100 text-zinc-700 dark:bg-slate-700 dark:text-slate-300",
  negative: "bg-[#ffdad6] text-[#ba1a1a] dark:bg-red-900/30 dark:text-red-300",
};

const CONFIDENCE_BAR = {
  high:   { color: 'bg-emerald-500', pct: '95%' },
  medium: { color: 'bg-amber-500', pct: '70%' },
  low:    { color: "bg-zinc-400 dark:bg-slate-500", pct: "40%" },
};

export default function SharedCallReport() {
  const { token, callLogId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterScore, setFilterScore] = useState('all');
  const [expandedQuestions, setExpandedQuestions] = useState({});

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
    <div className="min-h-screen bg-[#f8f7ff] dark:bg-slate-900 flex items-center justify-center">
      <div className="text-[#64748b] dark:text-slate-400 text-sm">Loading…</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-[#f8f7ff] dark:bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <span className="material-symbols-outlined text-[48px] text-zinc-300 dark:text-slate-600 block mb-3">link_off</span>
        <p className="text-zinc-600 dark:text-slate-300 font-semibold">{error}</p>
        <Link to={`/share/${token}`} className="text-sm text-[#0d9488] mt-3 block">← Back to Report</Link>
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
    <div className="min-h-screen bg-[#f8f7ff] dark:bg-slate-900">
      {/* Header */}
      <header className="bg-[#0f172a] px-8 py-5 flex items-center gap-4 shadow-sm">
        <div className="w-9 h-9 bg-[#0f766e] rounded flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-white text-[18px]" style={{fontVariationSettings:"'FILL' 1"}}>graphic_eq</span>
        </div>
        <div>
          <h1 className="text-white font-bold text-base leading-tight">AI Caller Pro</h1>
          <p className="text-zinc-400 text-[11px] uppercase tracking-widest font-mono">Shared Call Report</p>
        </div>
      </header>

      <main className="p-8 max-w-[1200px] mx-auto">
        <Link
          to={`/share/${token}`}
          className="flex items-center gap-2 text-[#334155] dark:text-slate-400 hover:text-[#0d9488] transition-all hover:-translate-x-1 font-bold mb-6 text-sm font-mono"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Back to Campaign Report
        </Link>

        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-slate-100">{callLog?.contact?.name || report?.contactName || 'Unknown'}</h2>
            <p className="text-zinc-500 dark:text-slate-400 text-sm mt-0.5 font-mono">{callLog?.contact?.phone} · {new Date(callLog?.createdAt || report?.createdAt).toLocaleString()}</p>
          </div>
          {callLog?.durationMs && (
            <span className="text-xs font-mono bg-zinc-100 dark:bg-slate-700 text-zinc-600 dark:text-slate-400 px-3 py-1.5 rounded-full shrink-0">
              {Math.round(callLog.durationMs / 1000)}s
            </span>
          )}
        </div>

        {/* Summary KPIs */}
        {report && (
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 p-5 rounded-xl shadow-sm">
              <p className="text-xs text-zinc-500 dark:text-slate-400 font-mono uppercase tracking-wider mb-2">Outcome</p>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${OUTCOME_BADGE[report.outcome] || "bg-zinc-100 text-zinc-600 dark:bg-slate-700 dark:text-slate-400"}`}>
                {(report.outcome || 'Unknown').replace('_', ' ')}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 p-5 rounded-xl shadow-sm">
              <p className="text-xs text-zinc-500 dark:text-slate-400 font-mono uppercase tracking-wider mb-2">QA Score</p>
              <p className="text-3xl font-bold text-[#0d9488]">{report.score ?? '—'}<span className="text-zinc-400 dark:text-slate-500 text-base font-semibold">/100</span></p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 p-5 rounded-xl shadow-sm">
              <p className="text-xs text-zinc-500 dark:text-slate-400 font-mono uppercase tracking-wider mb-2">Sentiment</p>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${SENTIMENT_BADGE[report.sentiment] || "bg-zinc-100 text-zinc-700 dark:bg-slate-700 dark:text-slate-300"}`}>
                {report.sentiment ? report.sentiment.charAt(0).toUpperCase() + report.sentiment.slice(1) : '—'}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 p-5 rounded-xl shadow-sm">
              <p className="text-xs text-zinc-500 dark:text-slate-400 font-mono uppercase tracking-wider mb-2">Completion</p>
              <p className="text-3xl font-bold text-zinc-900 dark:text-slate-100">{completionPercent != null ? `${completionPercent}%` : '—'}</p>
            </div>
          </section>
        )}

        {/* AI Summary */}
        {report?.reportSummary && (
          <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[#0d9488]" style={{fontVariationSettings:"'FILL' 1"}}>auto_awesome</span>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-slate-100">AI Summary</h3>
            </div>
            <p className="text-zinc-700 dark:text-slate-300 leading-relaxed">{report.reportSummary}</p>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* Audio Player */}
          {callLog?.hasRecording && (
            <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[#0d9488]" style={{fontVariationSettings:"'FILL' 1"}}>mic</span>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-slate-100">Recording</h3>
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
          <div className={`bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-xl shadow-sm p-6 ${callLog?.hasRecording ? '' : 'xl:col-span-2'}`}>
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[#0d9488]" style={{fontVariationSettings:"'FILL' 1"}}>chat</span>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-slate-100">Transcript</h3>
            </div>
            {turns.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {turns.map((t, i) => (
                  <div key={i} className={`flex gap-3 ${t.isAI ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${t.isAI ? "bg-[#0f766e] text-white" : "bg-zinc-200 dark:bg-slate-600 text-zinc-600 dark:text-slate-300"}`}>
                      {t.isAI ? 'AI' : 'U'}
                    </div>
                    <div className={`px-4 py-2.5 rounded-2xl max-w-[80%] text-sm leading-relaxed ${t.isAI ? "bg-[#e6fffa] dark:bg-teal-900/20 text-zinc-800 dark:text-slate-100 rounded-tl-sm" : "bg-zinc-100 dark:bg-slate-700 text-zinc-700 dark:text-slate-300 rounded-tr-sm"}`}>
                      {t.text}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400 dark:text-slate-500 italic">No transcript available.</p>
            )}
          </div>
        </div>

        {/* Evaluation Breakdown */}
        {questionResults.length > 0 && (
          <FullscreenTable className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
            {({ toggle, isFs }) => (<>
            <div className="p-6 border-b border-zinc-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-slate-100">Evaluation Breakdown</h3>
              <div className="flex items-center gap-2">
              <div className="flex bg-zinc-100 dark:bg-slate-700 p-1 rounded-lg">
                {[['all','All'],['full','Full Score'],['partial','Partial'],['failed','Failed']].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setFilterScore(key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors font-mono ${filterScore === key ? "bg-white dark:bg-slate-800 text-zinc-900 dark:text-slate-100 shadow-sm" : "text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-100"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <FullscreenButton toggle={toggle} isFs={isFs} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-50 dark:bg-slate-900 border-b border-zinc-100 dark:border-slate-700">
                  <tr>
                    {['Question', 'Answer', 'Scoring Rule', 'Points'].map(h => (
                      <th key={h} className="px-6 py-3 text-xs text-zinc-500 dark:text-slate-400 uppercase tracking-wider font-mono">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-slate-700/50">
                  {filteredQuestions.map(qr => {
                    const max = qr.weight || 0;
                    const awarded = qr.questionScore || 0;
                    const color = max === 0 ? "text-zinc-600 dark:text-slate-400" : awarded >= max ? 'text-emerald-600' : awarded === 0 ? 'text-[#ba1a1a]' : 'text-amber-600';
                    const mainRow = qr.breakdownRows?.find(r => r.rule !== 'Field present') || {};
                    const confStr = report?.extractedFields?.[mainRow.field]?.confidence || '—';
                    const conf = CONFIDENCE_BAR[confStr];

                    return (
                      <tr key={qr.questionId} className="hover:bg-zinc-50/70 dark:hover:bg-slate-700/50 transition-colors">
                        <td className="px-6 py-4 max-w-xs">
                          <p className="text-sm font-medium text-zinc-800 dark:text-slate-200 leading-snug">{qr.questionText || mainRow.questionText || qr.questionId}</p>
                        </td>
                        <td className="px-6 py-4">
                          {qr.answerExtracted ? (
                            <div>
                              <p className="text-sm text-zinc-800 dark:text-slate-200">{qr.answerExtracted}</p>
                              {conf && (
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="w-16 h-1 bg-zinc-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className={`h-full ${conf.color} rounded-full`} style={{width: conf.pct}} />
                                  </div>
                                  <span className="text-[10px] text-zinc-400 dark:text-slate-500 uppercase font-mono">{confStr}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400 dark:text-slate-500 italic">No answer</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-zinc-500 dark:text-slate-400 font-mono">{mainRow.rule || '—'}</span>
                          {mainRow.reason && <p className="text-[10px] text-zinc-400 dark:text-slate-500 mt-0.5">{mainRow.reason}</p>}
                        </td>
                        <td className={`px-6 py-4 font-bold text-sm font-mono ${color}`}>
                          {awarded}/{max}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>)}
          </FullscreenTable>
        )}
      </main>
    </div>
  );
}
