import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, BarChart3, TrendingUp, Target, AlertCircle,
  CheckCircle2, XCircle, ShieldCheck, FileText
} from 'lucide-react';

import { EVAL_BASE } from '../api/config';
import FullscreenWrapper from '../components/FullscreenWrapper';

const SENTIMENT_COLORS = {
  positive: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700',
  neutral:  'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
  negative: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
};

const OUTCOME_COLORS = {
  COMPLETED:    'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  NO_ANSWER:    'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  INCOMPLETE:   'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  WRONG_PERSON: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export default function CallReport() {
  const { campaignId, id } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) {
    return (
      <div className="animate-fade-in flex items-center justify-center min-h-[400px] text-zinc-500 dark:text-slate-400">
        Loading call report...
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in flex flex-col gap-4 max-w-4xl mx-auto py-8 px-4">
        <Link to={`/campaign/${campaignId}/calls/${id}`} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-100 transition-colors max-w-fit">
          <ArrowLeft size={14} /> Back to Call
        </Link>
        <div className="p-5 rounded-xl border border-red-200 bg-red-50 flex items-center gap-3 text-red-600 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      </div>
    );
  }

  const extractedEntries = Object.entries(report.extractedFields || {});
  const hasExtracted = extractedEntries.some(([_, v]) => v?.value != null);
  const missingFields = report.missingFields || [];
  const questionResults = report.reportData?.questionResults || [];
  const scoreBreakdown = report.scoreBreakdown || [];
  const compliance = report.complianceData || {};
  const completionPercent = report.completionRate != null ? Math.round(report.completionRate * 100) : null;

  return (
    <div className="animate-fade-in max-w-4xl mx-auto py-8 px-4 flex flex-col gap-6">
      {/* Header */}
      <div>
        <Link
          to={`/campaigns/${campaignId}/report`}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-slate-400 hover:text-zinc-900 dark:hover:text-slate-100 transition-colors mb-3"
        >
          <ArrowLeft size={14} /> Back to Campaign Report
        </Link>
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-slate-100 tracking-tight">Call Report</h2>
        <p className="text-zinc-500 dark:text-slate-400 text-sm mt-0.5">{report.contactName || 'Unknown Contact'}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.05]">
          <div className="text-xs font-medium text-zinc-500 dark:text-slate-400 mb-2.5">Outcome</div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${OUTCOME_COLORS[report.outcome] || 'bg-zinc-100 text-zinc-700 dark:bg-slate-700 dark:text-slate-300'}`}>
            {report.outcome === 'COMPLETED' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
            {report.outcome}
          </span>
          {report.failureReason && (
            <div className="text-[11px] text-zinc-500 dark:text-slate-400 mt-2 truncate" title={report.failureReason}>
              {report.failureReason}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.05]">
          <div className="text-xs font-medium text-zinc-500 dark:text-slate-400 mb-2.5">Sentiment</div>
          <span className={`inline-flex px-3 py-1.5 rounded-lg border text-xs font-semibold capitalize ${SENTIMENT_COLORS[report.sentiment] || SENTIMENT_COLORS.neutral}`}>
            {report.sentiment || '—'}
          </span>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.05]">
          <div className="text-xs font-medium text-zinc-500 dark:text-slate-400 flex items-center gap-1.5 mb-2.5">
            <TrendingUp size={11} className="text-emerald-500" /> Score
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-slate-100 tabular-nums tracking-tight">
            {report.score ?? '—'}<span className="text-sm font-normal text-zinc-400 dark:text-slate-500">/100</span>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.05]">
          <div className="text-xs font-medium text-zinc-500 dark:text-slate-400 flex items-center gap-1.5 mb-2.5">
            <Target size={11} className="text-blue-500" /> Completion
          </div>
          <div className="text-2xl font-bold text-blue-600 tabular-nums tracking-tight">
            {completionPercent != null ? `${completionPercent}%` : '—'}
          </div>
        </div>
      </div>

      {/* AI Summary */}
      {report.reportSummary && (
        <div className="rounded-2xl border border-zinc-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.05]">
          <h3 className="font-semibold text-sm text-zinc-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <FileText size={14} className="text-indigo-600" /> AI Summary
          </h3>
          <p className="text-sm text-zinc-600 dark:text-slate-400 leading-relaxed">{report.reportSummary}</p>
        </div>
      )}

      {/* Extracted Fields */}
      <FullscreenWrapper
        className="shadow-sm"
        title={
          <span className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">
            <BarChart3 size={13} className="text-indigo-600" /> Extracted Fields
          </span>
        }
      >
        {hasExtracted ? (
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 dark:bg-slate-900 border-b border-zinc-200 dark:border-slate-700 sticky top-0">
              <tr>
                {['Field', 'Value', 'Confidence', 'Raw Quote'].map(h => (
                  <th key={h} className="px-5 py-3 text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-slate-700">
              {extractedEntries.map(([key, val]) => (
                <tr key={key} className="hover:bg-zinc-50/70 dark:hover:bg-slate-700/50 transition-colors">
                  <td className="px-5 py-3 font-medium text-zinc-900 dark:text-slate-100 capitalize max-w-[200px] truncate" title={key}>{key}</td>
                  <td className="px-5 py-3 max-w-[240px]">
                    {val?.value != null ? (
                      <span className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 px-2 py-0.5 rounded text-xs font-medium block truncate" title={String(val.value)}>
                        {typeof val.value === 'object' ? JSON.stringify(val.value) : String(val.value)}
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-slate-500 italic text-xs">null</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded border ${
                      val?.confidence === 'high'   ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700' :
                      val?.confidence === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700' :
                      'bg-zinc-50 text-zinc-600 border-zinc-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'
                    }`}>
                      {val?.confidence || '-'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-500 dark:text-slate-400 italic max-w-[220px] truncate" title={val?.raw}>
                    {val?.raw || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-zinc-500 dark:text-slate-400 text-sm">
            No fields were extracted from this call. Check your campaign's Evaluation Rules.
          </div>
        )}
      </FullscreenWrapper>

      {/* Missing Fields */}
      {missingFields.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2 text-amber-800">
            <AlertCircle size={14} /> Missing Fields
          </h3>
          <div className="flex flex-wrap gap-2">
            {missingFields.map((f, i) => (
              <span key={i} className="bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-lg text-xs font-medium">
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Score Breakdown */}
      {(questionResults.length > 0 || scoreBreakdown.length > 0) && (
        <FullscreenWrapper
          className="shadow-sm"
          title={
            <span className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">
              <TrendingUp size={13} className="text-indigo-600" /> Score Breakdown
            </span>
          }
        >
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 dark:bg-slate-900 border-b border-zinc-200 dark:border-slate-700 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider w-8">#</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider w-[28%]">Question</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider w-[26%]">Expected Answer</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider w-[24%]">Actual Answer</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider text-right w-16">Weight</th>
                <th className="px-4 py-3 text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider text-right w-16">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-slate-700">
              {questionResults.map((qr, qIdx) => {
                const subFieldRows = (qr.breakdownRows || []).filter(r => r.rule === 'Field present');
                const questionRow  = (qr.breakdownRows || []).find(r => r.rule !== 'Field present');
                const awarded      = qr.questionScore ?? 0;
                const totalWeight  = qr.weight ?? 0;
                const isSkipped    = qr.skipped;
                const expectedRule = questionRow?.rule ?? (isSkipped ? 'Not asked' : 'Any answer');
                const isPartial    = questionRow?.reason === 'partial';
                const answerStr    = qr.answerExtracted || (isSkipped ? 'Not asked' : 'No answer');

                return (
                  <React.Fragment key={qr.questionId || qIdx}>
                    <tr className={`hover:bg-zinc-50/70 dark:hover:bg-slate-700/50 transition-colors ${isSkipped ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-zinc-100 dark:bg-slate-700 text-xs font-bold text-zinc-500 dark:text-slate-400">
                          {qIdx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 max-w-0 w-[28%]">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-slate-100" title={qr.questionText || '—'}>
                          {qr.questionText || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 max-w-0 w-[26%]">
                        <span className="block truncate text-xs bg-zinc-100 dark:bg-slate-700 border border-zinc-200 dark:border-slate-600 px-2 py-1 rounded font-mono text-zinc-700 dark:text-slate-300" title={expectedRule}>
                          {expectedRule}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 max-w-0 w-[24%]">
                        <p className={`truncate text-sm ${qr.answerExtracted ? 'text-zinc-900 dark:text-slate-100' : 'italic text-zinc-400 dark:text-slate-500 text-xs'}`} title={answerStr}>
                          {answerStr}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-right text-zinc-400 dark:text-slate-500 text-xs tabular-nums w-16">
                        {totalWeight}%
                      </td>
                      <td className="px-4 py-2.5 text-right w-16">
                        <span className={`font-bold text-sm ${awarded > 0 ? 'text-emerald-600' : 'text-zinc-400 dark:text-slate-500'}`}>
                          +{awarded.toFixed(1)}
                        </span>
                        {isPartial && <span className="text-amber-600 text-[10px] font-normal ml-1">partial</span>}
                      </td>
                    </tr>

                    {subFieldRows.map((sf, sfIdx) => {
                      const sfAwarded = sf.awarded ?? 0;
                      const isPresent = sf.reason === 'present';
                      const sfValueStr = isPresent ? sf.fieldValue : 'Missing';
                      return (
                        <tr key={sfIdx} className="bg-zinc-50/30 dark:bg-slate-800/50 hover:bg-zinc-50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2 pl-8 max-w-0 w-[28%]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-zinc-300 dark:text-slate-600 shrink-0">└</span>
                              <span className="truncate text-xs font-medium text-zinc-600 dark:text-slate-400" title={sf.field}>{sf.field}</span>
                              <span className="shrink-0 text-[10px] text-zinc-400 dark:text-slate-500">field</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 w-[26%]">
                            <span className="text-xs text-zinc-500 dark:text-slate-400 bg-zinc-100 dark:bg-slate-700 px-2 py-0.5 rounded whitespace-nowrap">Field present</span>
                          </td>
                          <td className="px-4 py-2 max-w-0 w-[24%]">
                            <span className={`block truncate text-xs px-2 py-0.5 rounded border font-medium ${
                              isPresent ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700' : 'bg-red-50 text-red-700 border-red-200 italic dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
                            }`} title={sfValueStr}>
                              {sfValueStr}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-xs text-zinc-400 dark:text-slate-500 tabular-nums w-16">{sf.weight}%</td>
                          <td className="px-4 py-2 text-right w-16">
                            <span className={`text-xs font-semibold ${sfAwarded > 0 ? 'text-emerald-600' : 'text-zinc-400 dark:text-slate-500'}`}>
                              +{sfAwarded.toFixed(1)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </FullscreenWrapper>
      )}

      {/* Compliance */}
      {Object.keys(compliance).length > 0 && (
        <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-6">
          <h3 className="font-semibold text-sm text-zinc-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <ShieldCheck size={14} className="text-indigo-600" /> Compliance
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 dark:text-slate-400 uppercase font-semibold">Identity Verified</span>
              <span className={`text-sm font-bold ${compliance.identityVerified ? 'text-emerald-600' : 'text-red-600'}`}>
                {compliance.identityVerified ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 dark:text-slate-400 uppercase font-semibold">Closure Delivered</span>
              <span className={`text-sm font-bold ${compliance.closureDelivered ? 'text-emerald-600' : 'text-red-600'}`}>
                {compliance.closureDelivered ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 dark:text-slate-400 uppercase font-semibold cursor-help underline decoration-dotted" title="Script Adherence = 20pts if identity verified + 20pts if closure delivered + up to 60pts based on % of questions asked.">
                Script Adherence
              </span>
              <span className="text-sm font-bold text-zinc-900 dark:text-slate-100">{compliance.scriptAdherenceScore ?? '-'}%</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 dark:text-slate-400 uppercase font-semibold cursor-help underline decoration-dotted" title="% of configured questions that were actually asked by the agent.">
                Question Coverage
              </span>
              <span className="text-sm font-bold text-zinc-900 dark:text-slate-100">{compliance.questionCoverage != null ? `${Math.round(compliance.questionCoverage * 100)}%` : '-'}</span>
            </div>
          </div>
          {compliance.questionsAsked?.length > 0 && (
            <div className="mt-4 flex flex-col gap-1">
              <span className="text-xs text-zinc-500 dark:text-slate-400 uppercase font-semibold">Questions Asked</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {compliance.questionsAsked.map((q, i) => (
                  <span key={i} className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 px-2 py-0.5 rounded text-xs">{q}</span>
                ))}
              </div>
            </div>
          )}
          {compliance.questionsSkipped?.length > 0 && (
            <div className="mt-3 flex flex-col gap-1">
              <span className="text-xs text-zinc-500 dark:text-slate-400 uppercase font-semibold">Questions Not Asked</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {compliance.questionsSkipped.map((q, i) => (
                  <span key={i} className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded text-xs">{q}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-zinc-400 dark:text-slate-500 text-center pb-4">
        Model: {report.modelVersion || '-'} · Schema: {report.schemaVersion || '-'} · Generated: {report.updatedAt ? new Date(report.updatedAt).toLocaleString() : '-'}
      </div>
    </div>
  );
}
