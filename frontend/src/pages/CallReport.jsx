import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { GripVertical } from 'lucide-react';
import { EVAL_BASE } from '../api/config';
import PageLoader from '../components/PageLoader';
import FullscreenTable, { FullscreenButton } from '../components/FullscreenTable';

const OUTCOME_BADGE = {
  COMPLETED:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  NO_ANSWER:    "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  INCOMPLETE:   "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  WRONG_PERSON: "bg-[#ffdad6] text-[#ba1a1a] dark:bg-red-900/30 dark:text-red-300",
};

const SENTIMENT_BADGE = {
  positive: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  neutral:  "bg-zinc-100 text-zinc-700 dark:bg-slate-700 dark:text-slate-300",
  negative: "bg-[#ffdad6] text-[#ba1a1a] dark:bg-red-900/30 dark:text-red-300",
};

const SENTIMENT_ICON = {
  positive: 'sentiment_very_satisfied',
  neutral:  'sentiment_neutral',
  negative: 'sentiment_dissatisfied',
};

const CONFIDENCE_BAR = {
  high:   { color: 'bg-emerald-500', pct: '95%' },
  medium: { color: 'bg-amber-500', pct: '70%' },
  low:    { color: "bg-zinc-400 dark:bg-slate-500", pct: "40%" },
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
    const fetchReport = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${EVAL_BASE}/reports/call/${id}`);
        setReport(res.data);
        setError(null);
      } catch (err) {
        if (err.response?.status === 404) {
          setError('No evaluation report found for this call. Run AI Evaluation first.');
        } else {
          setError('Could not load report. Make sure the evaluation service is running.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id]);

  if (loading) return <PageLoader text="Loading call report…" />;

  if (error) return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <Link to={`/campaign/${campaignId}/calls/${id}`} className="flex items-center gap-2 text-[#334155] dark:text-slate-400 hover:text-[#0d9488] transition-colors text-sm mb-6">
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Call
      </Link>
      <div className="p-5 rounded-xl border border-[#ffdad6] dark:border-red-800 bg-[#ffdad6]/30 dark:bg-red-900/20 flex items-center gap-3 text-[#ba1a1a] dark:text-red-300 text-sm">
        <span className="material-symbols-outlined">error</span>
        {error}
      </div>
    </div>
  );

  const extractedEntries = Object.entries(report.extractedFields || {});
  const hasExtracted = extractedEntries.some(([_, v]) => v?.value != null);
  const questionResults = report.reportData?.questionResults || [];
  const scoreBreakdown = report.scoreBreakdown || [];
  const compliance = report.complianceData || {};
  const completionPercent = report.completionRate != null ? Math.round(report.completionRate * 100) : null;
  const missingFields = report.missingFields || [];

  const scoreW = report.score != null ? `${Math.min(100, report.score)}%` : '0%';
  const completionW = completionPercent != null ? `${completionPercent}%` : '0%';
  const identityConfirmed = report.reportData?.identityConfirmed;

  const outcomeBadge = OUTCOME_BADGE[report.outcome] || "bg-zinc-100 text-zinc-700 dark:bg-slate-700 dark:text-slate-300";
  const sentimentBadge = SENTIMENT_BADGE[report.sentiment] || "bg-zinc-100 text-zinc-700 dark:bg-slate-700 dark:text-slate-300";
  const sentimentIcon = SENTIMENT_ICON[report.sentiment] || 'sentiment_neutral';

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      {/* Back link */}
      <Link
        to={`/campaigns/${campaignId}/report`}
        className="flex items-center gap-2 text-[#334155] dark:text-slate-400 hover:text-[#0d9488] transition-all hover:-translate-x-1 font-bold mb-6 text-sm"
      >
        <span className="material-symbols-outlined">arrow_back</span>
        Back to Campaign Report
      </Link>

      {/* Wrong person banner */}
      {identityConfirmed === false && (
        <div className="mb-6 p-4 rounded-xl border border-[#ba1a1a]/30 dark:border-red-800 bg-[#ffdad6]/40 dark:bg-red-900/20 flex items-center gap-3">
          <span className="material-symbols-outlined text-[#ba1a1a] dark:text-red-300 text-2xl" style={{fontVariationSettings:"'FILL' 1"}}>gpp_bad</span>
          <div>
            <p className="text-sm font-semibold text-[#ba1a1a] dark:text-red-300">Identity Not Confirmed — Wrong Person</p>
            <p className="text-xs text-[#ba1a1a]/80 dark:text-red-300/70 mt-0.5">The person who answered denied being {report.contactName || 'the intended contact'}. The call was ended with an apology. No questions were collected.</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 p-6 rounded-lg shadow-sm">
          <p className="text-zinc-500 dark:text-slate-400 text-xs font-medium mb-4 uppercase tracking-wider">Outcome</p>
          <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 w-fit ${outcomeBadge}`}>
            <span className="material-symbols-outlined text-[18px]">
              {report.outcome === 'COMPLETED' ? 'check_circle' : 'cancel'}
            </span>
            {(report.outcome || 'Unknown').replace('_', ' ')}
          </span>
          {report.failureReason && (
            <p className="text-xs text-zinc-500 dark:text-slate-400 mt-2 truncate" title={report.failureReason}>{report.failureReason}</p>
          )}
        </div>

        <div className={`p-6 rounded-lg shadow-sm border ${identityConfirmed === false ? "bg-[#ffdad6]/40 dark:bg-red-900/20 border-[#ba1a1a]/30 dark:border-red-800" : identityConfirmed === true ? "bg-emerald-50/60 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-700" : "bg-white dark:bg-slate-800 border-zinc-200 dark:border-slate-700"}`}>
          <p className="text-zinc-500 dark:text-slate-400 text-xs font-medium mb-4 uppercase tracking-wider">Identity Verified</p>
          {identityConfirmed === true && (
            <span className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 w-fit bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <span className="material-symbols-outlined text-[18px]" style={{fontVariationSettings:"'FILL' 1"}}>verified_user</span>
              Confirmed
            </span>
          )}
          {identityConfirmed === false && (
            <span className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 w-fit bg-[#ffdad6] text-[#ba1a1a] dark:bg-red-900/30 dark:text-red-300">
              <span className="material-symbols-outlined text-[18px]" style={{fontVariationSettings:"'FILL' 1"}}>gpp_bad</span>
              Wrong Person
            </span>
          )}
          {identityConfirmed === null || identityConfirmed === undefined ? (
            <span className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 w-fit bg-zinc-100 text-zinc-500 dark:bg-slate-700 dark:text-slate-400">
              <span className="material-symbols-outlined text-[18px]">help</span>
              Unknown
            </span>
          ) : null}
        </div>

        <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 p-6 rounded-lg shadow-sm">
          <p className="text-zinc-500 dark:text-slate-400 text-xs font-medium mb-4 uppercase tracking-wider">Sentiment</p>
          <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 w-fit ${sentimentBadge}`}>
            <span className="material-symbols-outlined text-[18px]">{sentimentIcon}</span>
            {report.sentiment ? report.sentiment.charAt(0).toUpperCase() + report.sentiment.slice(1) : '—'}
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 p-6 rounded-lg shadow-sm">
          <p className="text-zinc-500 dark:text-slate-400 text-xs font-medium mb-4 uppercase tracking-wider">QA Score</p>
          <div className="flex items-end gap-1">
            <span className="text-5xl font-bold text-[#0d9488] leading-none">{report.score ?? '—'}</span>
            <span className="text-zinc-400 dark:text-slate-500 text-2xl font-semibold pb-1">/100</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 p-6 rounded-lg shadow-sm">
          <p className="text-zinc-500 dark:text-slate-400 text-xs font-medium mb-4 uppercase tracking-wider">Completion</p>
          <div className="flex items-center gap-4">
            <span className="text-5xl font-bold text-[#0f172a] dark:text-slate-100 leading-none">
              {completionPercent != null ? `${completionPercent}%` : '—'}
            </span>
            {completionPercent != null && (
              <div className="flex-1 bg-zinc-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                <div className="bg-[#0d9488] h-full" style={{width: completionW}} />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-6">
        {/* AI Summary */}
        {report.reportSummary && (
          <div className="col-span-12">
            <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-lg shadow-sm p-8">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-[#0d9488]" style={{fontVariationSettings:"'FILL' 1"}}>auto_awesome</span>
                <h3 className="text-sm font-semibold text-[#0f172a] dark:text-slate-100">AI Call Summary</h3>
              </div>
              <p className="text-sm text-[#334155] dark:text-slate-400 leading-relaxed">{report.reportSummary}</p>
            </div>
          </div>
        )}

        {/* Evaluation Breakdown Table */}
        {(scoreBreakdown.length > 0 || hasExtracted) && (
          <div className="col-span-12">
            <FullscreenTable className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden h-full">
              {({ toggle, isFs }) => (<>
              <div className="p-6 border-b border-zinc-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-sm font-semibold text-[#0f172a] dark:text-slate-100">Evaluation Breakdown</h3>

                <div className="flex items-center gap-2">
                <div className="flex bg-zinc-100 dark:bg-slate-700 p-1 rounded-lg">
                  <button 
                    onClick={() => setFilterScore('all')}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${filterScore === 'all' ? "bg-white dark:bg-slate-800 text-zinc-900 dark:text-slate-100 shadow-sm" : "text-zinc-600 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-100"}`}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setFilterScore('full')}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${filterScore === 'full' ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 shadow-sm" : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"}`}
                  >
                    Full Score
                  </button>
                  <button 
                    onClick={() => setFilterScore('partial')}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${filterScore === 'partial' ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 shadow-sm" : "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"}`}
                  >
                    Partial
                  </button>
                  <button 
                    onClick={() => setFilterScore('failed')}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${filterScore === 'failed' ? "bg-[#ffdad6] dark:bg-red-900/30 text-[#ba1a1a] dark:text-red-300 shadow-sm" : "text-[#ba1a1a] dark:text-red-400 hover:bg-[#ffdad6]/50 dark:hover:bg-red-900/20"}`}
                  >
                    Failed
                  </button>
                </div>
                <FullscreenButton toggle={toggle} isFs={isFs} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="text-left table-fixed" style={{ width: Object.values(colWidths).reduce((a, b) => a + b, 0), minWidth: '100%' }}>
                  <colgroup>
                    {BREAKDOWN_COLUMNS.map(c => (
                      <col key={c.key} style={{ width: colWidths[c.key] }} />
                    ))}
                  </colgroup>
                  <thead className="bg-zinc-50 dark:bg-slate-900 border-b border-zinc-100 dark:border-slate-700">
                    <tr>
                      {BREAKDOWN_COLUMNS.map((c, i) => (
                        <th key={c.key} className="relative px-6 py-4 text-xs font-medium text-zinc-500 dark:text-slate-400 uppercase tracking-wider select-none">
                          <span className="truncate block pr-2">{c.label}</span>
                          {i < BREAKDOWN_COLUMNS.length - 1 && (
                            <span
                              onMouseDown={handleResizeStart(c.key)}
                              className="absolute top-0 -right-2.5 h-full w-5 cursor-col-resize flex items-center justify-center group z-10"
                              title="Drag to resize column"
                            >
                              <GripVertical
                                size={14}
                                className="text-zinc-400 dark:text-slate-500 group-hover:text-teal-500 transition-colors shrink-0"
                              />
                            </span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-slate-700">
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
                            <td colSpan={6} className="px-6 py-12 text-center text-sm text-zinc-400 dark:text-slate-500 italic">
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
                        if (maxPoints === 0) return "text-zinc-600 dark:text-slate-400";
                        if (awarded >= maxPoints) return 'text-emerald-600';
                        if (awarded === 0) return 'text-[#ba1a1a]';
                        return 'text-amber-600';
                      };
                      
                      // For the main row, we should display the total question score, not just the single breakdown row's score
                      const qAwarded = qr.questionScore || 0;
                      const qMax = qr.weight || 0;
                      const mainColorClass = getRowColorClass(qAwarded, qMax);

                      return (
                        <React.Fragment key={qr.questionId}>
                          <tr 
                            className={`hover:bg-zinc-50/50 dark:hover:bg-slate-700/50 transition-colors ${hasSubfields ? 'cursor-pointer' : ''}`}
                            onClick={() => hasSubfields && setExpandedQuestions(p => ({ ...p, [qr.questionId]: !p[qr.questionId] }))}
                          >
                            <td className="px-6 py-4 truncate font-medium text-[#0f172a] dark:text-slate-100" title={qr.questionText}>
                              <div className="flex items-center gap-2">
                                {hasSubfields && (
                                  <span className="material-symbols-outlined text-[18px] text-zinc-400 dark:text-slate-500">
                                    {isExpanded ? 'expand_more' : 'chevron_right'}
                                  </span>
                                )}
                                <span className="truncate">{qr.questionText}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {/* For sub-field questions show the extracted answer; for simple questions show the scored value */}
                              {(() => {
                                const displayVal = hasSubfields
                                  ? (qr.answerExtracted || `${subRows.filter(r => r.reason === 'present').length}/${subRows.length} fields`)
                                  : (mainRow.fieldValue);
                                return (
                                  <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 px-3 py-1 rounded-full text-xs font-medium max-w-full truncate inline-block align-middle" title={String(displayVal || '—')}>
                                    {typeof displayVal === 'object' ? JSON.stringify(displayVal) : String(displayVal || '—')}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-4">
                              {confStr !== '—' ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-12 bg-zinc-100 dark:bg-slate-700 h-1.5 rounded-full">
                                    <div className={`${conf.color} h-full rounded-full`} style={{width: conf.pct}} />
                                  </div>
                                  <span className="text-zinc-500 dark:text-slate-400 text-xs">{confStr}</span>
                                </div>
                              ) : (
                                <span className="text-zinc-500 dark:text-slate-400 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-600 dark:text-slate-400 truncate" title={mainRow.rule}>
                              {mainRow.rule || '—'}
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-500 dark:text-slate-400 truncate" title={mainRow.explanation || ''}>
                              {mainRow.explanation || '—'}
                            </td>
                            <td className={`px-6 py-4 font-medium whitespace-nowrap ${mainColorClass}`}>
                              +{qAwarded.toFixed(1)} / {qMax}
                            </td>
                          </tr>

                          {/* Sub-fields Expansion */}
                          {hasSubfields && isExpanded && subRows.map((sub, idx) => {
                            const subConfStr = report.extractedFields?.[sub.field]?.confidence || '—';
                            const subConf = CONFIDENCE_BAR[subConfStr] || CONFIDENCE_BAR.low;
                            const subColorClass = getRowColorClass(sub.awarded, sub.maxPoints);
                            
                            return (
                              <tr key={`${qr.questionId}-sub-${idx}`} className="bg-zinc-50/30 dark:bg-slate-900/30">
                                <td className={`px-6 py-3 pl-14 truncate text-sm ${subColorClass}`} title={sub.field}>
                                  ↳ {sub.field}
                                </td>
                                <td className="px-6 py-3">
                                  <span className="bg-emerald-50/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full text-xs font-medium max-w-full truncate inline-block align-middle" title={sub.fieldValue}>
                                    {typeof sub.fieldValue === 'object' ? JSON.stringify(sub.fieldValue) : String(sub.fieldValue || '—')}
                                  </span>
                                </td>
                                <td className="px-6 py-3">
                                  {subConfStr !== '—' ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-12 bg-zinc-100 dark:bg-slate-700 h-1.5 rounded-full">
                                        <div className={`${subConf.color} h-full rounded-full`} style={{width: subConf.pct}} />
                                      </div>
                                      <span className="text-zinc-500 dark:text-slate-400 text-xs">{subConfStr}</span>
                                    </div>
                                  ) : (
                                    <span className="text-zinc-500 dark:text-slate-400 text-xs">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-3 text-sm text-zinc-500 dark:text-slate-400 truncate" title={sub.rule}>
                                  {sub.rule || '—'}
                                </td>
                                <td className="px-6 py-3 text-sm text-zinc-400 dark:text-slate-500">—</td>
                                <td className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${subColorClass}`}>
                                  +{(sub.awarded ?? 0).toFixed(1)} / {sub.maxPoints ?? 0}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Compliance info inside the same card if it exists */}
              {Object.keys(compliance).length > 0 && (
                <div className="p-6 border-t border-zinc-100 dark:border-slate-700 bg-zinc-50/50 dark:bg-slate-900/50">
                  <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg flex items-start gap-3 w-fit">
                    <span className="material-symbols-outlined text-teal-600 dark:text-teal-400 mt-0.5">info</span>
                    <div>
                      <p className="text-xs font-medium text-teal-900 dark:text-teal-300 mb-1">Compliance Notes</p>
                      <p className="text-xs text-teal-800 dark:text-teal-400">
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
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-amber-800 dark:text-amber-300">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                Missing Fields
              </h3>
              <div className="flex flex-wrap gap-2">
                {missingFields.map((f, i) => (
                  <span key={i} className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-700 px-3 py-1 rounded-lg text-xs font-medium">{f}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer meta */}
      <div className="mt-8 text-xs text-zinc-400 dark:text-slate-500 text-center">
        Model: {report.modelVersion || '—'} · Schema: {report.schemaVersion || '—'} · Generated: {report.updatedAt ? new Date(report.updatedAt).toLocaleString() : '—'}
      </div>
    </div>
  );
}
