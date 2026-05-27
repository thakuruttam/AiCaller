import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { EVAL_BASE } from '../api/config';

const OUTCOME_BADGE = {
  COMPLETED:    'bg-emerald-50 text-emerald-700',
  NO_ANSWER:    'bg-amber-50 text-amber-700',
  INCOMPLETE:   'bg-orange-50 text-orange-700',
  WRONG_PERSON: 'bg-[#ffdad6] text-[#ba1a1a]',
};

const SENTIMENT_BADGE = {
  positive: 'bg-indigo-50 text-indigo-700',
  neutral:  'bg-zinc-100 text-zinc-700',
  negative: 'bg-[#ffdad6] text-[#ba1a1a]',
};

const SENTIMENT_ICON = {
  positive: 'sentiment_very_satisfied',
  neutral:  'sentiment_neutral',
  negative: 'sentiment_dissatisfied',
};

const CONFIDENCE_BAR = {
  high:   { color: 'bg-emerald-500', pct: '95%' },
  medium: { color: 'bg-amber-500', pct: '70%' },
  low:    { color: 'bg-zinc-400', pct: '40%' },
};

export default function CallReport() {
  const { campaignId, id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedQuestions, setExpandedQuestions] = useState({});
  const [filterScore, setFilterScore] = useState('all');

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

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#777587]">Loading call report...</div>
  );

  if (error) return (
    <div className="p-8 max-w-[1200px] mx-auto">
      <Link to={`/campaign/${campaignId}/calls/${id}`} className="flex items-center gap-2 text-[#464555] hover:text-[#3525cd] transition-colors text-sm mb-6" style={{fontFamily:'JetBrains Mono, monospace'}}>
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Back to Call
      </Link>
      <div className="p-5 rounded-xl border border-[#ffdad6] bg-[#ffdad6]/30 flex items-center gap-3 text-[#ba1a1a] text-sm">
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

  const outcomeBadge = OUTCOME_BADGE[report.outcome] || 'bg-zinc-100 text-zinc-700';
  const sentimentBadge = SENTIMENT_BADGE[report.sentiment] || 'bg-zinc-100 text-zinc-700';
  const sentimentIcon = SENTIMENT_ICON[report.sentiment] || 'sentiment_neutral';

  return (
    <div className="p-8 max-w-[1200px] mx-auto">
      {/* Back link */}
      <Link
        to={`/campaigns/${campaignId}/report`}
        className="flex items-center gap-2 text-[#464555] hover:text-[#3525cd] transition-all hover:-translate-x-1 font-bold mb-6 text-sm"
        style={{fontFamily:'JetBrains Mono, monospace'}}
      >
        <span className="material-symbols-outlined">arrow_back</span>
        Back to Campaign Report
      </Link>

      {/* Wrong person banner */}
      {identityConfirmed === false && (
        <div className="mb-6 p-4 rounded-xl border border-[#ba1a1a]/30 bg-[#ffdad6]/40 flex items-center gap-3">
          <span className="material-symbols-outlined text-[#ba1a1a] text-2xl" style={{fontVariationSettings:"'FILL' 1"}}>gpp_bad</span>
          <div>
            <p className="text-sm font-semibold text-[#ba1a1a]" style={{fontFamily:'JetBrains Mono, monospace'}}>Identity Not Confirmed — Wrong Person</p>
            <p className="text-xs text-[#ba1a1a]/80 mt-0.5">The person who answered denied being {report.contactName || 'the intended contact'}. The call was ended with an apology. No questions were collected.</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <section className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white border border-zinc-200 p-6 rounded-lg shadow-sm">
          <p className="text-zinc-500 text-xs mb-4 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Outcome</p>
          <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 w-fit ${outcomeBadge}`} style={{fontFamily:'JetBrains Mono, monospace'}}>
            <span className="material-symbols-outlined text-[18px]">
              {report.outcome === 'COMPLETED' ? 'check_circle' : 'cancel'}
            </span>
            {(report.outcome || 'Unknown').replace('_', ' ')}
          </span>
          {report.failureReason && (
            <p className="text-xs text-zinc-500 mt-2 truncate" title={report.failureReason}>{report.failureReason}</p>
          )}
        </div>

        <div className={`p-6 rounded-lg shadow-sm border ${identityConfirmed === false ? 'bg-[#ffdad6]/40 border-[#ba1a1a]/30' : identityConfirmed === true ? 'bg-emerald-50/60 border-emerald-200' : 'bg-white border-zinc-200'}`}>
          <p className="text-zinc-500 text-xs mb-4 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Identity Verified</p>
          {identityConfirmed === true && (
            <span className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 w-fit bg-emerald-100 text-emerald-700" style={{fontFamily:'JetBrains Mono, monospace'}}>
              <span className="material-symbols-outlined text-[18px]" style={{fontVariationSettings:"'FILL' 1"}}>verified_user</span>
              Confirmed
            </span>
          )}
          {identityConfirmed === false && (
            <span className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 w-fit bg-[#ffdad6] text-[#ba1a1a]" style={{fontFamily:'JetBrains Mono, monospace'}}>
              <span className="material-symbols-outlined text-[18px]" style={{fontVariationSettings:"'FILL' 1"}}>gpp_bad</span>
              Wrong Person
            </span>
          )}
          {identityConfirmed === null || identityConfirmed === undefined ? (
            <span className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 w-fit bg-zinc-100 text-zinc-500" style={{fontFamily:'JetBrains Mono, monospace'}}>
              <span className="material-symbols-outlined text-[18px]">help</span>
              Unknown
            </span>
          ) : null}
        </div>

        <div className="bg-white border border-zinc-200 p-6 rounded-lg shadow-sm">
          <p className="text-zinc-500 text-xs mb-4 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Sentiment</p>
          <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 w-fit ${sentimentBadge}`} style={{fontFamily:'JetBrains Mono, monospace'}}>
            <span className="material-symbols-outlined text-[18px]">{sentimentIcon}</span>
            {report.sentiment ? report.sentiment.charAt(0).toUpperCase() + report.sentiment.slice(1) : '—'}
          </span>
        </div>

        <div className="bg-white border border-zinc-200 p-6 rounded-lg shadow-sm">
          <p className="text-zinc-500 text-xs mb-4 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>QA Score</p>
          <div className="flex items-end gap-1">
            <span className="text-5xl font-bold text-[#3525cd] leading-none">{report.score ?? '—'}</span>
            <span className="text-zinc-400 text-2xl font-semibold pb-1">/100</span>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 p-6 rounded-lg shadow-sm">
          <p className="text-zinc-500 text-xs mb-4 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Completion</p>
          <div className="flex items-center gap-4">
            <span className="text-5xl font-bold text-[#1b1b24] leading-none">
              {completionPercent != null ? `${completionPercent}%` : '—'}
            </span>
            {completionPercent != null && (
              <div className="flex-1 bg-zinc-100 h-2 rounded-full overflow-hidden">
                <div className="bg-[#3525cd] h-full" style={{width: completionW}} />
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-6">
        {/* AI Summary */}
        {report.reportSummary && (
          <div className="col-span-12">
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm p-8">
              <div className="flex items-center gap-2 mb-6">
                <span className="material-symbols-outlined text-[#3525cd]" style={{fontVariationSettings:"'FILL' 1"}}>auto_awesome</span>
                <h3 className="text-2xl font-semibold text-[#1b1b24]">AI Call Summary</h3>
              </div>
              <p className="text-lg text-[#464555] leading-relaxed">{report.reportSummary}</p>
            </div>
          </div>
        )}

        {/* Evaluation Breakdown Table */}
        {(scoreBreakdown.length > 0 || hasExtracted) && (
          <div className="col-span-12">
            <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden h-full">
              <div className="p-6 border-b border-zinc-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h3 className="text-2xl font-semibold text-[#1b1b24]">Evaluation Breakdown</h3>
                
                <div className="flex bg-zinc-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setFilterScore('all')}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${filterScore === 'all' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
                    style={{fontFamily:'JetBrains Mono, monospace'}}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setFilterScore('full')}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${filterScore === 'full' ? 'bg-emerald-100 text-emerald-800 shadow-sm' : 'text-emerald-600 hover:bg-emerald-50'}`}
                    style={{fontFamily:'JetBrains Mono, monospace'}}
                  >
                    Full Score
                  </button>
                  <button 
                    onClick={() => setFilterScore('partial')}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${filterScore === 'partial' ? 'bg-amber-100 text-amber-800 shadow-sm' : 'text-amber-600 hover:bg-amber-50'}`}
                    style={{fontFamily:'JetBrains Mono, monospace'}}
                  >
                    Partial
                  </button>
                  <button 
                    onClick={() => setFilterScore('failed')}
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${filterScore === 'failed' ? 'bg-[#ffdad6] text-[#ba1a1a] shadow-sm' : 'text-[#ba1a1a] hover:bg-[#ffdad6]/50'}`}
                    style={{fontFamily:'JetBrains Mono, monospace'}}
                  >
                    Failed
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 border-b border-zinc-100">
                    <tr>
                      {['Question', 'Answer', 'Confidence', 'Scoring Rule', 'Points'].map(h => (
                        <th key={h} className="px-6 py-4 text-xs text-zinc-500 uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {questionResults.filter(qr => {
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
                    }).map((qr) => {
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
                        if (maxPoints === 0) return 'text-zinc-600';
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
                            className={`hover:bg-zinc-50/50 transition-colors ${hasSubfields ? 'cursor-pointer' : ''}`}
                            onClick={() => hasSubfields && setExpandedQuestions(p => ({ ...p, [qr.questionId]: !p[qr.questionId] }))}
                          >
                            <td className="px-6 py-4 max-w-[250px] truncate font-medium text-[#1b1b24]" title={qr.questionText} style={{fontFamily:'JetBrains Mono, monospace'}}>
                              <div className="flex items-center gap-2">
                                {hasSubfields && (
                                  <span className="material-symbols-outlined text-[18px] text-zinc-400">
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
                                  <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium max-w-[200px] truncate inline-block align-middle" style={{fontFamily:'JetBrains Mono, monospace'}} title={String(displayVal || '—')}>
                                    {typeof displayVal === 'object' ? JSON.stringify(displayVal) : String(displayVal || '—')}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-4">
                              {confStr !== '—' ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-12 bg-zinc-100 h-1.5 rounded-full">
                                    <div className={`${conf.color} h-full rounded-full`} style={{width: conf.pct}} />
                                  </div>
                                  <span className="text-zinc-500 text-xs" style={{fontFamily:'JetBrains Mono, monospace'}}>{confStr}</span>
                                </div>
                              ) : (
                                <span className="text-zinc-500 text-xs" style={{fontFamily:'JetBrains Mono, monospace'}}>—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-600 max-w-[200px] truncate" title={mainRow.rule}>
                              {mainRow.rule || '—'}
                            </td>
                            <td className={`px-6 py-4 font-medium whitespace-nowrap ${mainColorClass}`} style={{fontFamily:'JetBrains Mono, monospace'}}>
                              +{qAwarded.toFixed(1)} / {qMax}
                            </td>
                          </tr>
                          
                          {/* Sub-fields Expansion */}
                          {hasSubfields && isExpanded && subRows.map((sub, idx) => {
                            const subConfStr = report.extractedFields?.[sub.field]?.confidence || '—';
                            const subConf = CONFIDENCE_BAR[subConfStr] || CONFIDENCE_BAR.low;
                            const subColorClass = getRowColorClass(sub.awarded, sub.maxPoints);
                            
                            return (
                              <tr key={`${qr.questionId}-sub-${idx}`} className="bg-zinc-50/30">
                                <td className={`px-6 py-3 pl-14 max-w-[250px] truncate text-sm ${subColorClass}`} title={sub.field} style={{fontFamily:'JetBrains Mono, monospace'}}>
                                  ↳ {sub.field}
                                </td>
                                <td className="px-6 py-3">
                                  <span className="bg-emerald-50/50 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium max-w-[200px] truncate inline-block align-middle" style={{fontFamily:'JetBrains Mono, monospace'}} title={sub.fieldValue}>
                                    {typeof sub.fieldValue === 'object' ? JSON.stringify(sub.fieldValue) : String(sub.fieldValue || '—')}
                                  </span>
                                </td>
                                <td className="px-6 py-3">
                                  {subConfStr !== '—' ? (
                                    <div className="flex items-center gap-2">
                                      <div className="w-12 bg-zinc-100 h-1.5 rounded-full">
                                        <div className={`${subConf.color} h-full rounded-full`} style={{width: subConf.pct}} />
                                      </div>
                                      <span className="text-zinc-500 text-xs" style={{fontFamily:'JetBrains Mono, monospace'}}>{subConfStr}</span>
                                    </div>
                                  ) : (
                                    <span className="text-zinc-500 text-xs" style={{fontFamily:'JetBrains Mono, monospace'}}>—</span>
                                  )}
                                </td>
                                <td className="px-6 py-3 text-sm text-zinc-500 max-w-[200px] truncate" title={sub.rule}>
                                  {sub.rule || '—'}
                                </td>
                                <td className={`px-6 py-3 font-medium text-sm whitespace-nowrap ${subColorClass}`} style={{fontFamily:'JetBrains Mono, monospace'}}>
                                  +{(sub.awarded ?? 0).toFixed(1)} / {sub.maxPoints ?? 0}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Compliance info inside the same card if it exists */}
              {Object.keys(compliance).length > 0 && (
                <div className="p-6 border-t border-zinc-100 bg-zinc-50/50">
                  <div className="bg-indigo-50 p-4 rounded-lg flex items-start gap-3 w-fit">
                    <span className="material-symbols-outlined text-indigo-600 mt-0.5">info</span>
                    <div>
                      <p className="text-xs font-medium text-indigo-900 mb-1" style={{fontFamily:'JetBrains Mono, monospace'}}>Compliance Notes</p>
                      <p className="text-xs text-indigo-800">
                        Script adherence: {compliance.scriptAdherenceScore ?? '—'}% &middot;
                        Coverage: {compliance.questionCoverage != null ? `${Math.round(compliance.questionCoverage * 100)}%` : '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Missing Fields */}
        {missingFields.length > 0 && (
          <div className="col-span-12">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-amber-800">
                <span className="material-symbols-outlined text-[18px]">warning</span>
                Missing Fields
              </h3>
              <div className="flex flex-wrap gap-2">
                {missingFields.map((f, i) => (
                  <span key={i} className="bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-lg text-xs font-medium" style={{fontFamily:'JetBrains Mono, monospace'}}>{f}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer meta */}
      <div className="mt-8 text-xs text-zinc-400 text-center" style={{fontFamily:'JetBrains Mono, monospace'}}>
        Model: {report.modelVersion || '—'} · Schema: {report.schemaVersion || '—'} · Generated: {report.updatedAt ? new Date(report.updatedAt).toLocaleString() : '—'}
      </div>
    </div>
  );
}
