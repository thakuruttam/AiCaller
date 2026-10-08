import React, { useEffect, useState } from 'react';
import {
  Tabs, Table, THead, Th, TBody, Tr, Td, TableToolbar,
  PageHeader, BackLink, EmptyState, Badge, Card, CardHeader, StatCard, Progress, statusLabel,
} from '../components/ui';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE } from '../api/config';
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

const OUTCOME_TONE = {
  COMPLETED:    'positive',
  NO_ANSWER:    'neutral',
  INCOMPLETE:   'caution',
  WRONG_PERSON: 'negative',
  RESCHEDULE:   'brand',
  BUSY:         'neutral',
  FAILED:       'negative',
};

const SENTIMENT_TONE = {
  positive: 'brand',
  neutral:  'neutral',
  negative: 'negative',
};

const CONFIDENCE_BAR = {
  high:   { color: 'bg-positive', pct: '95%' },
  medium: { color: 'bg-caution', pct: '70%' },
  low:    { color: 'bg-paper-900 dark:bg-ink-700', pct: '40%' },
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
      <PageLoader text="Loading…" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-paper-200 dark:bg-ink-50 flex items-center justify-center">
      <EmptyState
        icon="link_off"
        title={error}
        action={<BackLink to={`/share/${token}`}>Back to Report</BackLink>}
      />
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
      <header className="bg-ink-100 page-gutter py-5 flex items-center gap-4 shadow-card">
        <div className="w-9 h-9 bg-brand-500 rounded flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-white text-[18px]" style={{fontVariationSettings:"'FILL' 1"}}>graphic_eq</span>
        </div>
        <div>
          <h1 className="text-white font-bold text-base leading-tight">AI Caller Pro</h1>
          <p className="text-muted-foreground text-xs font-medium ">Shared Call Report</p>
        </div>
      </header>

      <main className="page-gutter pt-6 pb-10">
        <PageHeader
          back={{ to: `/share/${token}`, label: 'Back to Campaign Report' }}
          title={callLog?.contact?.name || report?.contactName || 'Unknown'}
          subtitle={`${callLog?.contact?.phone || ''} · ${new Date(callLog?.createdAt || report?.createdAt).toLocaleString()}`}
          actions={callLog?.durationMs && (
            <Badge tone="neutral" dot={false} capitalize={false}>{Math.round(callLog.durationMs / 1000)}s</Badge>
          )}
          className="!mb-6"
        />

        {/* Summary KPIs */}
        {report && (
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-7">
            <StatCard
              icon="flag"
              label="Outcome"
              value={<Badge tone={OUTCOME_TONE[report.outcome] || 'neutral'}>{statusLabel(report.outcome || 'Unknown')}</Badge>}
            />
            <StatCard
              icon="star"
              label="QA score"
              value={<>{report.score ?? '—'}<span className="text-lg text-muted-foreground"> /100</span></>}
            />
            <StatCard
              icon="sentiment_satisfied"
              label="Sentiment"
              value={<Badge tone={SENTIMENT_TONE[report.sentiment] || 'neutral'}>{report.sentiment || '—'}</Badge>}
            />
            <StatCard
              icon="percent"
              label="Completion"
              value={completionPercent != null ? `${completionPercent}%` : '—'}
            >
              {completionPercent != null && <Progress value={completionPercent} />}
            </StatCard>
          </section>
        )}

        {/* AI Summary */}
        {report?.reportSummary && (
          <Card className="mb-7">
            <CardHeader title="AI Summary" icon="auto_awesome" />
            <p className="text-sm text-muted-foreground leading-relaxed">{report.reportSummary}</p>
          </Card>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-7">
          {/* Audio Player */}
          {callLog?.hasRecording && (
            <Card>
              <CardHeader title="Recording" icon="mic" />
              <audio
                controls
                className="w-full"
                src={audioUrl}
                preload="metadata"
              >
                Your browser does not support audio playback.
              </audio>
            </Card>
          )}

          {/* Transcript */}
          <Card className={callLog?.hasRecording ? '' : 'xl:col-span-2'}>
            <CardHeader title="Transcript" icon="chat" />
            {turns.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {turns.map((t, i) => (
                  <div key={i} className={`flex gap-3 ${t.isAI ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${t.isAI ? "bg-brand-500 text-white" : "bg-paper-400 dark:bg-white/10 text-muted-foreground"}`}>
                      {t.isAI ? 'AI' : 'U'}
                    </div>
                    <div className={`px-4 py-2.5 rounded-xl max-w-[80%] text-sm leading-relaxed ${t.isAI ? 'bg-brand-500/10 text-foreground rounded-tl-sm' : 'bg-paper-200 dark:bg-white/[0.04] text-foreground rounded-tr-sm'}`}>
                      {t.text}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No transcript available.</p>
            )}
          </Card>
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
                  const color = max === 0 ? 'text-muted-foreground' : awarded >= max ? 'text-positive-dim' : awarded === 0 ? 'text-negative-dim' : 'text-caution-dim';
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
                                <div className="w-16 h-1 bg-paper-400 dark:bg-white/10 rounded-full overflow-hidden">
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
                        <span className={`font-semibold ${color}`}>{awarded}/{max}</span>
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
