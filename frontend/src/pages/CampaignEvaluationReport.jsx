import React, { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, Target, Activity, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { EVAL_BASE } from '../api/config';

export default function CampaignEvaluationReport({ campaignId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [contactsTotal, setContactsTotal] = useState(0);

  useEffect(() => {
    if (!campaignId) return;

    const fetchReport = async () => {
      try {
        setLoading(true);
        // Call the evaluation service directly
        const [resMetrics, resContacts] = await Promise.all([
          axios.get(`${EVAL_BASE}/reports/campaign/${campaignId}`),
          axios.get(`${EVAL_BASE}/reports/campaign/${campaignId}/contacts?limit=50`)
        ]);
        setReport(resMetrics.data);
        setContacts(resContacts.data.contacts || []);
        setContactsTotal(resContacts.data.total || 0);
        setError(null);
      } catch (err) {
        console.error("Failed to load evaluation report", err);
        setError("Evaluation report not available or service is offline.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
    
    // Refresh the report every 15 seconds
    const interval = setInterval(fetchReport, 15000);
    return () => clearInterval(interval);
  }, [campaignId]);

  if (loading && !report) {
    return <div className="p-6 rounded-xl border bg-card shadow-sm animate-pulse flex items-center justify-center text-muted-foreground min-h-[150px]">Loading Evaluation Analytics...</div>;
  }

  if (error && !report) {
    return (
      <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex items-center gap-3 text-destructive text-sm">
        <AlertCircle size={16} /> {error}
      </div>
    );
  }

  if (!report || report.totalCalls === 0) {
    return (
      <div className="p-6 rounded-xl border bg-card shadow-sm flex flex-col items-center justify-center text-muted-foreground min-h-[150px]">
        <BarChart3 size={32} className="mb-2 opacity-20" />
        <p className="text-sm font-medium text-foreground">No Evaluation Data Yet</p>
        <p className="text-xs">Once calls are completed and evaluated, analytics will appear here.</p>
      </div>
    );
  }

  // Parse percentages
  const completionPercent = Math.round((parseFloat(report.completionRate) || 0) * 100);

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="border-b px-6 py-4 flex items-center justify-between">
         <h3 className="font-semibold text-lg m-0 flex items-center gap-2">
           <Activity size={18} className="text-primary" /> Evaluation Analytics
         </h3>
         <a 
           href={`${EVAL_BASE}/reports/campaign/${campaignId}/export.csv`} 
           download 
           className="text-xs font-medium bg-secondary text-secondary-foreground px-3 py-1.5 rounded hover:bg-secondary/80 transition-colors"
         >
           Download Full CSV Report
         </a>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Total Calls Evaluated */}
        <div className="p-4 flex flex-col gap-1 transition-colors hover:bg-muted/5">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Evaluated</div>
          <div className="text-2xl font-bold tracking-tight">{report.totalCalls}</div>
          <div className="text-[10px] text-muted-foreground">Calls processed by AI</div>
        </div>

        {/* Completion Rate */}
        <div className="p-4 flex flex-col gap-1 transition-colors hover:bg-muted/5">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Target size={12} className="text-blue-500" /> Completion Rate
          </div>
          <div className="text-2xl font-bold tracking-tight text-blue-600">{completionPercent}%</div>
          <div className="text-[10px] text-muted-foreground">Reached end of script</div>
        </div>

        {/* Average Score */}
        <div className="p-4 flex flex-col gap-1 transition-colors hover:bg-muted/5">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp size={12} className="text-green-500" /> Average AI Score
          </div>
          <div className="text-2xl font-bold tracking-tight text-green-600">{report.score?.avg ?? '-'}</div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-2">
            <span>High: <strong className="text-foreground">{report.score?.max ?? '-'}</strong></span>
            <span>Low: <strong className="text-foreground">{report.score?.min ?? '-'}</strong></span>
          </div>
        </div>

        {/* Sentiment Overview */}
        <div className="p-4 flex flex-col gap-1 transition-colors hover:bg-muted/5">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sentiment</div>
          <div className="flex flex-col gap-1 mt-1">
            {Object.entries(report.sentimentBreakdown || {}).length > 0 ? (
              Object.entries(report.sentimentBreakdown).slice(0, 3).map(([sentiment, count]) => {
                const isPos = sentiment.toLowerCase() === 'positive';
                const isNeg = sentiment.toLowerCase() === 'negative';
                const color = isPos ? 'bg-green-100 text-green-800 border-green-200' : isNeg ? 'bg-red-100 text-red-800 border-red-200' : 'bg-zinc-100 text-zinc-800 border-zinc-200';
                return (
                  <div key={sentiment} className="flex items-center justify-between text-[11px] leading-tight">
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase ${color}`}>{sentiment}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                );
              })
            ) : (
              <span className="text-[11px] text-muted-foreground italic">No sentiment data</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabular Data Report */}
      {contacts.length > 0 && (
        <div className="border-t">
          <div className="px-6 py-3 bg-muted/30 border-b flex justify-between items-center">
            <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-tight flex items-center gap-2">
               <Activity size={12} /> Recent Evaluated Calls
            </h4>
            <span className="text-[10px] font-medium text-muted-foreground bg-background px-2 py-0.5 rounded border shadow-sm">
              {contacts.length} / {contactsTotal}
            </span>
          </div>
          <div className="overflow-auto max-h-[400px]">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b">
                <tr>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 font-medium">Outcome</th>
                  <th className="px-6 py-3 font-medium">Sentiment</th>
                  <th className="px-6 py-3 font-medium">Score</th>
                  <th className="px-6 py-3 font-medium">Extracted Data</th>
                  <th className="px-6 py-3 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {contacts.map((c) => {
                  const extractedEntries = Object.entries(c.extractedFields || {}).filter(([_, v]) => v.value != null);
                  return (
                    <tr key={c.callLogId} className="bg-card hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 font-medium whitespace-nowrap">{c.contactName || 'Unknown'}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${c.outcome === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {c.outcome}
                        </span>
                      </td>
                      <td className="px-6 py-4 capitalize">{c.sentiment || '-'}</td>
                      <td className="px-6 py-4 font-bold">{c.score !== null ? c.score : '-'}</td>
                      <td className="px-6 py-4 text-xs">
                        {extractedEntries.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {extractedEntries.map(([key, val]) => (
                              <span key={key} className="bg-muted px-1.5 py-0.5 rounded text-muted-foreground border">
                                <strong>{key}:</strong> {typeof val.value === 'object' ? '...' : val.value}
                              </span>
                            ))}
                          </div>
                        ) : <span className="text-muted-foreground italic">None</span>}
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground max-w-[250px] truncate" title={c.reportSummary}>
                        {c.reportSummary || '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
