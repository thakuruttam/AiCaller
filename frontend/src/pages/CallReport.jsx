import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Tabs, Table, THead, Th, TBody, Tr, Td, TableToolbar,
  BackLink, Alert, Badge, Card, CardHeader, StatCard, Progress, statusLabel,
} from '../components/ui';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { GripVertical } from 'lucide-react';
import { EVAL_BASE } from '../api/config';
import PageLoader from '../components/PageLoader';

// Badge tones for the eval outcome. NO_ANSWER reads as caution here (the
// call didn't get its answers), unlike the neutral it gets in call lists.
const OUTCOME_TONE = {
  COMPLETED:    'positive',
  NO_ANSWER:    'caution',
  INCOMPLETE:   'caution',
  WRONG_PERSON: 'negative',
};

const SENTIMENT_TONE = {
  positive: 'brand',
  neutral:  'neutral',
  negative: 'negative',
};

const SENTIMENT_ICON = {
  positive: 'sentiment_very_satisfied',
  neutral:  'sentiment_neutral',
  negative: 'sentiment_dissatisfied',
};

const CONFIDENCE_BAR = {
  high:   { color: 'bg-positive', pct: '95%' },
  medium: { color: 'bg-caution', pct: '70%' },
  low:    { color: 'bg-paper-900 dark:bg-ink-700', pct: '40%' },
};

const BREAKDOWN_COLUMNS = [
  { key: 'question',   label: 'Question',     defaultWidth: 260, minWidth: 120 },
  { key: 'answer',     label: 'Answer',       defaultWidth: 200, minWidth: 100 },
  { key: 'confidence', label: 'Confidence',   defaultWidth: 130, minWidth: 90 },
  { key: 'rule',       label: 'Scoring Rule', defaultWidth: 220, minWidth: 100 },
  { key: 'reason',     label: 'Reason',       defaultWidth: 240, minWidth: 100 },
  { key: 'points',     label: 'Points',       defaultWidth: 110, minWidth: 80 },
];

export default function CallReport() {
  const { campaignId, id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);
  const [expandedQuestions, setExpandedQuestions] = useState({});
  const [filterScore, setFilterScore] = useState('all');

  // Drag-to-resize for the breakdown table's columns.
  const [colWidths, setColWidths] = useState(() =>
    Object.fromEntries(BREAKDOWN_COLUMNS.map(c => [c.key, c.defaultWidth]))
  );
  const resizeState = useRef(null); // { key, startX, startWidth }

  const handleResizeMove = useCallback((e) => {
    const rs = resizeState.current;
    if (!rs) return;
    const col = BREAKDOWN_COLUMNS.find(c => c.key === rs.key);
    const next = Math.max(col.minWidth, rs.startWidth + (e.clientX - rs.startX));
    setColWidths(w => ({ ...w, [rs.key]: next }));
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizeState.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove]);

  const handleResizeStart = useCallback((key) => (e) => {
    e.preventDefault();
    resizeState.current = { key, startX: e.clientX, startWidth: colWidths[key] };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [colWidths, handleResizeMove, handleResizeEnd]);

  useEffect(() => () => {
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove, handleResizeEnd]);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    // The eval pipeline usually finishes within ~1s of the call ending, but
    // opening this page right as the call hangs up can beat it — without a
    // retry, a single early 404 here used to stick as a permanent "no
    // report" error even after the report was written moments later (the
    // only way out was an admin re-eval, which just re-triggered the fetch).
    const MAX_ATTEMPTS = 10;
    const RETRY_DELAY_MS = 3000;

    const fetchReport = async () => {
      try {
        const res = await axios.get(`${EVAL_BASE}/reports/call/${id}`);
        if (cancelled) return;
        setReport(res.data);
        setError(null);
        setNotFound(false);
        setGenerating(false);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status === 404 && attempt < MAX_ATTEMPTS) {
          attempt += 1;
          setLoading(false);
          setGenerating(true); // still within the retry window — tell the user it's in progress, not broken
          setTimeout(fetchReport, RETRY_DELAY_MS);
          return;
        }
        setLoading(false);
        setGenerating(false);
        if (err.response?.status === 404) {
          // Retries exhausted with no report ever appearing — genuinely not
          // generating (vs. still-in-progress), so per instruction: no
          // error banner, just nothing.
          setNotFound(true);
        } else {
          setError('Could not load report. Make sure the evaluation service is running.');
        }
      }
    };

    setLoading(true);
    fetchReport();

    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <PageLoader text="Loading call report…" />;
  if (generating) return <PageLoader text="Generating report… this can take up to a minute." />;
  if (notFound) return null;

  if (error) return (
    <div className="page-gutter pt-5 pb-10 animate-fade-in">
      <BackLink to={`/campaign/${campaignId}/calls/${id}`} className="mb-7">Back to Call</BackLink>
      <Alert tone="negative" title="Report unavailable">{error}</Alert>
    </div>
  );

  const extractedEntries = Object.entries(report.extractedFields || {});
  const hasExtracted = extractedEntries.some(([, v]) => v?.value != null);
  const questionResults = report.reportData?.questionResults || [];
  const scoreBreakdown = report.scoreBreakdown || [];
  const compliance = report.complianceData || {};
  const completionPercent = report.completionRate != null ? Math.round(report.completionRate * 100) : null;
  const missingFields = report.missingFields || [];

  const identityConfirmed = report.reportData?.identityConfirmed;

  const outcomeTone = OUTCOME_TONE[report.outcome] || 'neutral';
  const sentimentTone = SENTIMENT_TONE[report.sentiment] || 'neutral';
  const sentimentIcon = SENTIMENT_ICON[report.sentiment] || 'sentiment_neutral';

  return (
    <div className="page-gutter pt-5 pb-10 animate-fade-in">
      <BackLink to={`/campaigns/${campaignId}/report`} className="mb-7">Back to Campaign Report</BackLink>

      {identityConfirmed === false && (
        <Alert tone="negative" title="Identity Not Confirmed — Wrong Person" className="mb-7">
          The person who answered denied being {report.contactName || 'the intended contact'}. The call was ended with an apology. No questions were collected.
        </Alert>
      )}

      {/* Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5 mb-7">
        <StatCard
          icon={report.outcome === 'COMPLETED' ? 'check_circle' : 'cancel'}
          tone={outcomeTone === 'positive' ? 'emerald' : outcomeTone === 'negative' ? 'pink' : 'orange'}
          label="Outcome"
          value={<Badge tone={outcomeTone}>{statusLabel(report.outcome || 'Unknown')}</Badge>}
          hint={report.failureReason && <span className="block truncate" title={report.failureReason}>{report.failureReason}</span>}
        />
        <StatCard
          icon={identityConfirmed === false ? 'gpp_bad' : identityConfirmed === true ? 'verified_user' : 'help'}
          tone={identityConfirmed === false ? 'pink' : identityConfirmed === true ? 'emerald' : 'sky'}
          label="Identity verified"
          value={
            identityConfirmed === true ? <Badge capitalize={false}>Confirmed</Badge>
              : identityConfirmed === false ? <Badge tone="negative" capitalize={false}>Wrong Person</Badge>
                : <Badge tone="neutral" capitalize={false}>Unknown</Badge>
          }
        />
        <StatCard
          icon={sentimentIcon}
          label="Sentiment"
          value={<Badge tone={sentimentTone}>{report.sentiment || '—'}</Badge>}
        />
        <StatCard
          icon="star"
          label="QA score"
          value={<>{report.score ?? '—'}<span className="text-lg text-muted-foreground"> /100</span></>}
        />
        <StatCard
          icon="percent"
          label="Completion"
          value={completionPercent != null ? `${completionPercent}%` : '—'}
        >
          {completionPercent != null && <Progress value={completionPercent} />}
        </StatCard>
      </section>

      <div className="grid grid-cols-12 gap-6">
        {/* AI Summary */}
        {report.reportSummary && (
          <div className="col-span-12">
            <Card>
              <CardHeader title="AI Call Summary" icon="auto_awesome" />
              <p className="text-sm text-muted-foreground leading-relaxed">{report.reportSummary}</p>
            </Card>
          </div>
        )}

        {/* Evaluation Breakdown Table */}
        {(scoreBreakdown.length > 0 || hasExtracted) && (
          <div className="col-span-12">
            <div className="bg-card dark:bg-muted rounded-2xl shadow-primary overflow-hidden h-full">
              <TableToolbar
                title="Evaluation breakdown"
                actions={<>
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
                </>}
              />
                <Table className="table-fixed" style={{ width: Object.values(colWidths).reduce((a, b) => a + b, 0), minWidth: '100%' }}>
                  <colgroup>
                    {BREAKDOWN_COLUMNS.map(c => (
                      <col key={c.key} style={{ width: colWidths[c.key] }} />
                    ))}
                  </colgroup>
                  <THead>
                      {BREAKDOWN_COLUMNS.map((c, i) => (
                        <Th key={c.key} align={c.key === 'points' ? 'right' : 'left'} className="relative">
                          <span className="truncate pr-2">{c.label}</span>
                          {i < BREAKDOWN_COLUMNS.length - 1 && (
                            <span
                              onMouseDown={handleResizeStart(c.key)}
                              className="absolute top-0 -right-2.5 h-full w-5 cursor-col-resize flex items-center justify-center group z-10"
                              title="Drag to resize column"
                            >
                              <GripVertical
                                size={14}
                                className="text-muted-foreground group-hover:text-brand-500 transition-colors shrink-0"
                              />
                            </span>
                          )}
                        </Th>
                      ))}
                  </THead>
                  <TBody>
                    {(() => {
                      const filteredQuestions = questionResults.filter(qr => {
                        if (filterScore === 'all') return true;
                        const maxPoints = qr.weight || 0;
                        const awarded = qr.questionScore || 0;
                        if (maxPoints === 0) return true; // always show zero-weight questions unless filtering strictly? Better to keep them in 'all' or evaluate them strictly based on score. Let's just evaluate numeric match.

                        const isFull = awarded >= maxPoints;
                        const isFailed = awarded === 0;
                        const isPartial = awarded > 0 && awarded < maxPoints;

                        if (filterScore === 'full') return isFull;
                        if (filterScore === 'partial') return isPartial;
                        if (filterScore === 'failed') return isFailed;
                        return true;
                      });

                      if (filteredQuestions.length === 0) {
                        return (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-sm text-muted-foreground italic">
                              No questions match the "{filterScore}" filter.
                            </td>
                          </tr>
                        );
                      }

                      return filteredQuestions.map((qr) => {
                      // Sub-field rows are always those with rule "Field present"
                      // The main row evaluates the expectedAnswer condition (or skipped state)
                      const subRows = qr.breakdownRows?.filter(r => r.rule === 'Field present') || [];
                      const mainRow = qr.breakdownRows?.find(r => r.rule !== 'Field present') || {};
                      const hasSubfields = subRows.length > 0;
                      const isExpanded = !!expandedQuestions[qr.questionId];

                      const confStr = report.extractedFields?.[mainRow.field]?.confidence
                        || (hasSubfields ? (subRows.find(r => r.reason === 'present') ? 'high' : '—') : '—')
                        || '—';
                      const conf = CONFIDENCE_BAR[confStr] || CONFIDENCE_BAR.low;

                      const getRowColorClass = (awarded = 0, maxPoints = 0) => {
                        if (maxPoints === 0) return 'text-muted-foreground';
                        if (awarded >= maxPoints) return 'text-positive-dim';
                        if (awarded === 0) return 'text-negative-dim';
                        return 'text-caution-dim';
                      };
                      
                      // For the main row, we should display the total question score, not just the single breakdown row's score
                      const qAwarded = qr.questionScore || 0;
                      const qMax = qr.weight || 0;
                      const mainColorClass = getRowColorClass(qAwarded, qMax);

                      return (
                        <React.Fragment key={qr.questionId}>
                          <Tr
                            aria-expanded={hasSubfields ? isExpanded : undefined}
                            onClick={hasSubfields ? () => setExpandedQuestions(p => ({ ...p, [qr.questionId]: !p[qr.questionId] })) : undefined}
                          >
                            <Td className="truncate font-medium" title={qr.questionText}>
                              <div className="flex items-center gap-2">
                                {hasSubfields && (
                                  <span className="material-symbols-outlined [--icon-size:18px] text-muted-foreground">
                                    {isExpanded ? 'expand_more' : 'chevron_right'}
                                  </span>
                                )}
                                <span className="truncate">{qr.questionText}</span>
                              </div>
                            </Td>
                            <Td>
                              {/* For sub-field questions show the extracted answer; for simple questions show the scored value */}
                              {(() => {
                                const displayVal = hasSubfields
                                  ? (qr.answerExtracted || `${subRows.filter(r => r.reason === 'present').length}/${subRows.length} fields`)
                                  : (mainRow.fieldValue);
                                return (
                                  <Badge tone="positive" dot={false} capitalize={false} className="max-w-full overflow-hidden align-middle">
                                    <span className="truncate" title={String(displayVal || '—')}>
                                      {typeof displayVal === 'object' ? JSON.stringify(displayVal) : String(displayVal || '—')}
                                    </span>
                                  </Badge>
                                );
                              })()}
                            </Td>
                            <Td>
                              {confStr !== '—' ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-12 bg-paper-400 dark:bg-white/10 h-1.5 rounded-full">
                                    <div className={`${conf.color} h-full rounded-full`} style={{width: conf.pct}} />
                                  </div>
                                  <span className="text-muted-foreground text-xs">{confStr}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </Td>
                            <Td muted className="truncate" title={mainRow.rule}>
                              {mainRow.rule || '—'}
                            </Td>
                            <Td muted className="truncate" title={mainRow.explanation || ''}>
                              {mainRow.explanation || '—'}
                            </Td>
                            <Td numeric className={`font-medium ${mainColorClass}`}>
                              +{qAwarded.toFixed(1)} / {qMax}
                            </Td>
                          </Tr>

                          {/* Sub-fields Expansion */}
                          {hasSubfields && isExpanded && subRows.map((sub, idx) => {
                            const subConfStr = report.extractedFields?.[sub.field]?.confidence || '—';
                            const subConf = CONFIDENCE_BAR[subConfStr] || CONFIDENCE_BAR.low;
                            const subColorClass = getRowColorClass(sub.awarded, sub.maxPoints);
                            
                            return (
                              <Tr key={`${qr.questionId}-sub-${idx}`} className="bg-paper-200/40 dark:bg-white/[0.015]">
                                <Td className={`!pl-12 truncate ${subColorClass}`} title={sub.field}>
                                  ↳ {sub.field}
                                </Td>
                                <Td>
                                  <Badge tone="positive" dot={false} capitalize={false} className="max-w-full overflow-hidden align-middle">
                                    <span className="truncate" title={sub.fieldValue}>
                                      {typeof sub.fieldValue === 'object' ? JSON.stringify(sub.fieldValue) : String(sub.fieldValue || '—')}
                                    </span>
                                  </Badge>
                                </Td>
                                <Td>
                                  {subConfStr !== '—' ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-12 bg-paper-400 dark:bg-white/10 h-1.5 rounded-full">
                                        <div className={`${subConf.color} h-full rounded-full`} style={{width: subConf.pct}} />
                                      </div>
                                      <span className="text-muted-foreground text-xs">{subConfStr}</span>
                                    </div>
                                  ) : (
                                    <span className="text-muted-foreground text-xs">—</span>
                                  )}
                                </Td>
                                <Td muted className="truncate" title={sub.rule}>
                                  {sub.rule || '—'}
                                </Td>
                                <Td muted>—</Td>
                                <Td numeric className={`font-medium ${subColorClass}`}>
                                  +{(sub.awarded ?? 0).toFixed(1)} / {sub.maxPoints ?? 0}
                                </Td>
                              </Tr>
                            );
                          })}
                        </React.Fragment>
                      );
                      });
                    })()}
                  </TBody>
                </Table>

              {/* Compliance info inside the same card if it exists */}
              {Object.keys(compliance).length > 0 && (
                <div className="px-5 py-4 border-t border-border">
                  <Alert tone="info" title="Compliance Notes" className="w-fit">
                    Script adherence: {compliance.scriptAdherenceScore ?? '—'}% &middot;
                    Coverage: {compliance.questionCoverage != null ? `${Math.round(compliance.questionCoverage * 100)}%` : '—'}
                  </Alert>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Missing Fields */}
        {missingFields.length > 0 && (
          <div className="col-span-12">
            <Alert tone="caution" title="Missing Fields">
              <div className="flex flex-wrap gap-2 mt-2">
                {missingFields.map((f, i) => (
                  <Badge key={i} tone="caution" dot={false} capitalize={false}>{f}</Badge>
                ))}
              </div>
            </Alert>
          </div>
        )}
      </div>

      {/* Footer meta */}
      <div className="mt-7 text-xs text-muted-foreground text-center">
        Model: {report.modelVersion || '—'} · Schema: {report.schemaVersion || '—'} · Generated: {report.updatedAt ? new Date(report.updatedAt).toLocaleString() : '—'}
      </div>
    </div>
  );
}
