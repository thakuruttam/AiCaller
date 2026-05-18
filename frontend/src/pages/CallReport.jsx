import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowLeft, BarChart3, TrendingUp, Target, AlertCircle,
  CheckCircle2, XCircle, ShieldCheck, FileText
} from 'lucide-react';

const EVAL_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const SENTIMENT_COLORS = {
  positive: 'bg-green-100 text-green-800 border-green-200',
  neutral:  'bg-zinc-100 text-zinc-800 border-zinc-200',
  negative: 'bg-red-100 text-red-800 border-red-200',
};

const OUTCOME_COLORS = {
  COMPLETED:    'bg-green-100 text-green-800',
  NO_ANSWER:    'bg-amber-100 text-amber-800',
  INCOMPLETE:   'bg-orange-100 text-orange-800',
  WRONG_PERSON: 'bg-red-100 text-red-800',
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
      <div className="animate-fade-in flex items-center justify-center min-h-[400px] text-muted-foreground">
        Loading call report...
      </div>
    );
  }

  if (error) {
    return (
      <div className="animate-fade-in flex flex-col gap-4 max-w-4xl mx-auto py-8 px-4">
        <Link to={`/campaign/${campaignId}/calls/${id}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium max-w-fit">
          <ArrowLeft size={16} /> Back to Call
        </Link>
        <div className="p-6 rounded-xl border border-destructive/20 bg-destructive/5 flex items-center gap-3 text-destructive text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      </div>
    );
  }

  const extractedEntries = Object.entries(report.extractedFields || {});
  const hasExtracted = extractedEntries.some(([_, v]) => v?.value != null);
  const missingFields = report.missingFields || [];
  const scoreBreakdown = report.scoreBreakdown || [];
  const compliance = report.complianceData || {};
  const completionPercent = report.completionRate != null ? Math.round(report.completionRate * 100) : null;

  return (
    <div className="animate-fade-in max-w-4xl mx-auto py-8 px-4 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={`/campaign/${campaignId}/calls/${id}`} className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 border border-input bg-background hover:bg-zinc-100 transition-colors">
          <ArrowLeft size={16} className="mr-2" /> Back to Call
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Call Report</h2>
          <p className="text-muted-foreground text-sm mt-0.5">{report.contactName || 'Unknown Contact'}</p>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Outcome</div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold ${OUTCOME_COLORS[report.outcome] || 'bg-zinc-100 text-zinc-800'}`}>
            {report.outcome === 'COMPLETED' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
            {report.outcome}
          </span>
          {report.failureReason && (
            <div className="text-[10px] text-muted-foreground mt-2 italic truncate" title={report.failureReason}>Reason: {report.failureReason}</div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Sentiment</div>
          <span className={`inline-flex px-3 py-1 rounded-lg border text-xs font-bold uppercase ${SENTIMENT_COLORS[report.sentiment] || SENTIMENT_COLORS.neutral}`}>
            {report.sentiment || '-'}
          </span>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <TrendingUp size={12} className="text-green-500" /> Score
          </div>
          <div className="text-2xl font-bold tracking-tight">{report.score ?? '-'}<span className="text-sm font-normal text-muted-foreground">/100</span></div>
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm transition-all hover:shadow-md">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Target size={12} className="text-blue-500" /> Completion
          </div>
          <div className="text-2xl font-bold tracking-tight text-blue-600">{completionPercent != null ? `${completionPercent}%` : '-'}</div>
        </div>
      </div>

      {/* ── AI Summary ── */}
      {report.reportSummary && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <FileText size={16} className="text-primary" /> AI Summary
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{report.reportSummary}</p>
        </div>
      )}

      {/* ── Extracted Fields ── */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="border-b px-6 py-4">
          <h3 className="font-bold text-sm flex items-center gap-2 text-muted-foreground uppercase tracking-tight">
            <BarChart3 size={14} className="text-primary" /> Extracted Fields
          </h3>
        </div>
        {hasExtracted ? (
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="h-10 px-6 font-medium text-xs uppercase tracking-wider">Field</th>
                  <th className="h-10 px-6 font-medium text-xs uppercase tracking-wider">Value</th>
                  <th className="h-10 px-6 font-medium text-xs uppercase tracking-wider">Confidence</th>
                  <th className="h-10 px-6 font-medium text-xs uppercase tracking-wider">Raw Quote</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {extractedEntries.map(([key, val]) => (
                  <tr key={key} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-medium capitalize">{key}</td>
                    <td className="px-6 py-3">
                      {val?.value != null ? (
                        <span className="bg-green-50 text-green-800 border border-green-200 px-2 py-0.5 rounded text-xs font-medium">
                          {typeof val.value === 'object' ? JSON.stringify(val.value) : String(val.value)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">null</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded border ${
                        val?.confidence === 'high' ? 'bg-green-50 text-green-700 border-green-200' :
                        val?.confidence === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-zinc-50 text-zinc-600 border-zinc-200'
                      }`}>
                        {val?.confidence || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-muted-foreground italic max-w-[200px] truncate" title={val?.raw}>
                      {val?.raw || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No fields were extracted from this call. Check your campaign's Evaluation Rules.
          </div>
        )}
      </div>

      {/* ── Missing Fields ── */}
      {missingFields.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-6">
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2 text-amber-800">
            <AlertCircle size={16} /> Missing Fields
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

      {/* ── Score Breakdown ── */}
      {scoreBreakdown.length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <div className="border-b px-6 py-4">
            <h3 className="font-bold text-sm flex items-center gap-2 text-muted-foreground uppercase tracking-tight">
              <TrendingUp size={14} className="text-primary" /> Score Breakdown
            </h3>
          </div>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b text-muted-foreground">
                <tr>
                  <th className="h-10 px-6 font-medium text-xs uppercase tracking-wider">Rule</th>
                  <th className="h-10 px-6 font-medium text-xs uppercase tracking-wider">Field</th>
                  <th className="h-10 px-6 font-medium text-xs uppercase tracking-wider">Value</th>
                  <th className="h-10 px-6 font-medium text-xs uppercase tracking-wider text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scoreBreakdown.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-3 font-medium">{r.rule}</td>
                    <td className="px-6 py-3 text-muted-foreground">{r.field}</td>
                    <td className="px-6 py-3">{typeof r.fieldValue === 'object' ? JSON.stringify(r.fieldValue) : String(r.fieldValue)}</td>
                    <td className="px-6 py-3 text-right font-bold text-green-600">+{r.awarded}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Compliance Data ── */}
      {Object.keys(compliance).length > 0 && (
        <div className="rounded-xl border bg-card shadow-sm p-6">
          <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary" /> Compliance
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Identity Verified</span>
              <span className={`text-sm font-bold ${compliance.identityVerified ? 'text-green-600' : 'text-red-600'}`}>
                {compliance.identityVerified ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Closure Delivered</span>
              <span className={`text-sm font-bold ${compliance.closureDelivered ? 'text-green-600' : 'text-red-600'}`}>
                {compliance.closureDelivered ? 'Yes' : 'No'}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Script Adherence</span>
              <span className="text-sm font-bold">{compliance.scriptAdherenceScore ?? '-'}%</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Question Coverage</span>
              <span className="text-sm font-bold">{compliance.questionCoverage != null ? `${Math.round(compliance.questionCoverage * 100)}%` : '-'}</span>
            </div>
          </div>
          {compliance.questionsAsked?.length > 0 && (
            <div className="mt-4">
              <span className="text-xs text-muted-foreground uppercase font-semibold">Questions Asked</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {compliance.questionsAsked.map((q, i) => (
                  <span key={i} className="bg-muted border px-2 py-0.5 rounded text-xs">{q}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-muted-foreground text-center pb-4">
        Model: {report.modelVersion || '-'} · Schema: {report.schemaVersion || '-'} · Generated: {report.updatedAt ? new Date(report.updatedAt).toLocaleString() : '-'}
      </div>
    </div>
  );
}
