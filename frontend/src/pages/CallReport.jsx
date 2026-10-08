import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Button, IconButton, Tabs, Table, THead, Th, TBody, Tr, Td, TableToolbar,
} from '../components/ui';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { GripVertical } from 'lucide-react';
import { EVAL_BASE } from '../api/config';
import PageLoader from '../components/PageLoader';
import FullscreenTable, { FullscreenButton } from '../components/FullscreenTable';

const OUTCOME_BADGE = {
  COMPLETED:    'bg-positive/10 text-positive-dim dark:bg-positive/15 dark:text-positive',
  NO_ANSWER:    "bg-caution/10 text-caution-dim dark:bg-caution/15 dark:text-caution",
  INCOMPLETE:   "bg-caution/10 text-caution-dim dark:bg-caution/15 dark:text-caution",
  WRONG_PERSON: "bg-negative/10 text-negative-dim dark:bg-negative/15 dark:text-negative",
};

const SENTIMENT_BADGE = {
  positive: "bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
  neutral:  "bg-paper-400 text-ink-500 dark:bg-ink-300 dark:text-ink-900",
  negative: "bg-negative/10 text-negative-dim dark:bg-negative/15 dark:text-negative",
};

const SENTIMENT_ICON = {
  positive: 'sentiment_very_satisfied',
  neutral:  'sentiment_neutral',
  negative: 'sentiment_dissatisfied',
};

const CONFIDENCE_BAR = {
  high:   { color: 'bg-positive', pct: '95%' },
  medium: { color: 'bg-caution/100', pct: '70%' },
  low:    { color: "bg-paper-900 dark:bg-ink-700", pct: "40%" },
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
    <div className="page-gutter pt-3 pb-7 animate-fade-in">
      <Link to={`/campaign/${campaignId}/calls/${id}`} className="flex items-center gap-2 text-ink-600 dark:text-ink-900 hover:text-brand-500 transition-colors text-sm mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Call
      </Link>
      <div className="p-5 rounded-card border border-negative/10 dark:border-negative/15 bg-negative/10/30 dark:bg-negative/15 flex items-center gap-3 text-negative-dim dark:text-negative text-sm">
        <span className="material-symbols-outlined">error</span>
        {error}
      </div>
    </div>
  );

  const extractedEntries = Object.entries(report.extractedFields || {});
  const hasExtracted = extractedEntries.some(([, v]) => v?.value != null);
  const questionResults = report.reportData?.questionResults || [];
  const scoreBreakdown = report.scoreBreakdown || [];
  const compliance = report.complianceData || {};
  const completionPercent = report.completionRate != null ? Math.round(report.completionRate * 100) : null;
  const missingFields = report.missingFields || [];

  const completionW = completionPercent != null ? `${completionPercent}%` : '0%';
  const identityConfirmed = report.reportData?.identityConfirmed;

  const outcomeBadge = OUTCOME_BADGE[report.outcome] || "bg-paper-400 text-ink-500 dark:bg-ink-300 dark:text-ink-900";
  const sentimentBadge = SENTIMENT_BADGE[report.sentiment] || "bg-paper-400 text-ink-500 dark:bg-ink-300 dark:text-ink-900";
  const sentimentIcon = SENTIMENT_ICON[report.sentiment] || 'sentiment_neutral';

  return (
    <div className="page-gutter pt-3 pb-7 animate-fade-in">
      {/* Back link */}
      <Link
        to={`/campaigns/${campaignId}/report`}
        className="flex items-center gap-2 text-ink-600 dark:text-ink-900 hover:text-brand-500 transition-all hover:-translate-x-1 font-bold mb-6 text-sm"
      >
        <span className="material-symbols-outlined">arrow_back</span>
        Back to Campaign Report
      </Link>

      {/* Wrong person banner */}
      {identityConfirmed === false && (
        <div className="mb-6 p-4 rounded-card border border-negative-dim/30 dark:border-negative/15 bg-negative/10/40 dark:bg-negative/15 flex items-center gap-3">
          <span className="material-symbols-outlined text-negative-dim dark:text-negative text-2xl" style={{fontVariationSettings:"'FILL' 1"}}>gpp_bad</span>
          <div>
            <p className="text-sm font-semibold text-negative-dim dark:text-negative">Identity Not Confirmed — Wrong Person</p>
            <p className="text-xs text-negative-dim/80 dark:text-negative/70 mt-0.5">The person who answered denied being {report.contactName || 'the intended contact'}. The call was ended with an apology. No questions were collected.</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-6">
          <p className="text-ink-700 dark:text-ink-900 text-xs font-medium mb-4 ">Outcome</p>
          <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 w-fit ${outcomeBadge}`}>
            <span className="material-symbols-outlined text-[18px]">
              {report.outcome === 'COMPLETED' ? 'check_circle' : 'cancel'}
            </span>
            {(report.outcome || 'Unknown').replace('_', ' ')}
          </span>
          {report.failureReason && (
            <p className="text-xs text-ink-700 dark:text-ink-900 mt-2 truncate" title={report.failureReason}>{report.failureReason}</p>
          )}
        </div>

        <div className={`p-6 rounded-control shadow-card border ${identityConfirmed === false ? "bg-negative/10/40 dark:bg-negative/15 border-negative-dim/30 dark:border-negative/15" : identityConfirmed === true ? "bg-positive/10/60 dark:bg-positive/15 border-positive/30 dark:border-positive/15" : "bg-paper-100 dark:bg-ink-200 border-paper-500 dark:border-ink-400"}`}>
          <p className="text-ink-700 dark:text-ink-900 text-xs font-medium mb-4 ">Identity Verified</p>
          {identityConfirmed === true && (
            <span className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 w-fit bg-positive/10 text-positive-dim dark:bg-positive/15 dark:text-positive">
              <span className="material-symbols-outlined text-[18px]" style={{fontVariationSettings:"'FILL' 1"}}>verified_user</span>
              Confirmed
            </span>
          )}
          {identityConfirmed === false && (
            <span className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 w-fit bg-negative/10 text-negative-dim dark:bg-negative/15 dark:text-negative">
              <span className="material-symbols-outlined text-[18px]" style={{fontVariationSettings:"'FILL' 1"}}>gpp_bad</span>
              Wrong Person
            </span>
          )}
          {identityConfirmed === null || identityConfirmed === undefined ? (
            <span className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 w-fit bg-paper-400 text-ink-700 dark:bg-ink-300 dark:text-ink-900">
              <span className="material-symbols-outlined text-[18px]">help</span>
              Unknown
            </span>
          ) : null}
        </div>

        <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-6">
          <p className="text-ink-700 dark:text-ink-900 text-xs font-medium mb-4 ">Sentiment</p>
          <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 w-fit ${sentimentBadge}`}>
            <span className="material-symbols-outlined text-[18px]">{sentimentIcon}</span>
            {report.sentiment ? report.sentiment.charAt(0).toUpperCase() + report.sentiment.slice(1) : '—'}
          </span>
        </div>

        <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-6">
          <p className="text-ink-700 dark:text-ink-900 text-xs font-medium mb-4 ">QA Score</p>
          <div className="flex items-end gap-1">
            <span className="text-5xl font-bold text-brand-500 leading-none">{report.score ?? '—'}</span>
            <span className="text-ink-800 dark:text-ink-800 text-2xl font-semibold pb-1">/100</span>
          </div>
        </div>

        <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-6">
          <p className="text-ink-700 dark:text-ink-900 text-xs font-medium mb-4 ">Completion</p>
          <div className="flex items-center gap-4">
            <span className="text-5xl font-bold text-ink-100 dark:text-paper-200 leading-none">
              {completionPercent != null ? `${completionPercent}%` : '—'}
            </span>
            {completionPercent != null && (
              <div className="flex-1 bg-paper-400 dark:bg-ink-300 h-2 rounded-full overflow-hidden">
                <div className="bg-brand-500 h-full" style={{width: completionW}} />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-6">
        {/* AI Summary */}
        {report.reportSummary && (
          <div className="col-span-12">
            <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-8">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-brand-500" style={{fontVariationSettings:"'FILL' 1"}}>auto_awesome</span>
                <h3 className="text-sm font-semibold text-ink-100 dark:text-paper-200">AI Call Summary</h3>
              </div>
              <p className="text-sm text-ink-600 dark:text-ink-900 leading-relaxed">{report.reportSummary}</p>
            </div>
          </div>
        )}

        {/* Evaluation Breakdown Table */}
        {(scoreBreakdown.length > 0 || hasExtracted) && (
          <div className="col-span-12">
            <FullscreenTable className="bg-card dark:bg-muted rounded-2xl shadow-primary overflow-hidden h-full">
              {({ toggle, isFs }) => (<>
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
                  <FullscreenButton toggle={toggle} isFs={isFs} />
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
                                className="text-ink-800 dark:text-ink-800 group-hover:text-brand-500 transition-colors shrink-0"
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
                        if (maxPoints === 0) return "text-ink-600 dark:text-ink-900";
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
                                  <span className="bg-positive/10 text-positive-dim ring-1 ring-inset ring-positive/25 dark:text-positive dark:ring-positive/20 px-2 py-0.5 rounded-full text-xs font-medium max-w-full truncate inline-block align-middle" title={String(displayVal || '—')}>
                                    {typeof displayVal === 'object' ? JSON.stringify(displayVal) : String(displayVal || '—')}
                                  </span>
                                );
                              })()}
                            </Td>
                            <Td>
                              {confStr !== '—' ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-12 bg-paper-400 dark:bg-ink-300 h-1.5 rounded-full">
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
                                  <span className="bg-positive/10 text-positive-dim ring-1 ring-inset ring-positive/25 dark:text-positive dark:ring-positive/20 px-2 py-0.5 rounded-full text-xs font-medium max-w-full truncate inline-block align-middle" title={sub.fieldValue}>
                                    {typeof sub.fieldValue === 'object' ? JSON.stringify(sub.fieldValue) : String(sub.fieldValue || '—')}
                                  </span>
                                </Td>
                                <Td>
                                  {subConfStr !== '—' ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-12 bg-paper-400 dark:bg-ink-300 h-1.5 rounded-full">
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
                <div className="p-6 border-t border-paper-400 dark:border-ink-400 bg-paper-200/50 dark:bg-ink-50/50">
                  <div className="bg-brand-100 dark:bg-brand-500/15 p-4 rounded-control flex items-start gap-3 w-fit">
                    <span className="material-symbols-outlined text-brand-500 dark:text-brand-300 mt-0.5">info</span>
                    <div>
                      <p className="text-xs font-medium text-brand-600 dark:text-brand-300 mb-1">Compliance Notes</p>
                      <p className="text-xs text-brand-600 dark:text-brand-300">
                        Script adherence: {compliance.scriptAdherenceScore ?? '—'}% &middot;
                        Coverage: {compliance.questionCoverage != null ? `${Math.round(compliance.questionCoverage * 100)}%` : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              </>)}
            </FullscreenTable>
          </div>
        )}

        {/* Missing Fields */}
        {missingFields.length > 0 && (
          <div className="col-span-12">
            <div className="rounded-card border border-caution/30 dark:border-caution/15 bg-caution/10 dark:bg-caution/15 p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-caution-dim dark:text-caution">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                Missing Fields
              </h3>
              <div className="flex flex-wrap gap-2">
                {missingFields.map((f, i) => (
                  <span key={i} className="bg-caution/10 dark:bg-caution/15 text-caution-dim dark:text-caution border border-caution/30 dark:border-caution/15 px-3 py-1 rounded-control text-xs font-medium">{f}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer meta */}
      <div className="mt-8 text-xs text-ink-800 dark:text-ink-800 text-center">
        Model: {report.modelVersion || '—'} · Schema: {report.schemaVersion || '—'} · Generated: {report.updatedAt ? new Date(report.updatedAt).toLocaleString() : '—'}
      </div>
    </div>
  );
}
