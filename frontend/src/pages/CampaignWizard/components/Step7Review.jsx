import React from 'react';
import {
  ClipboardList, PhoneCall, Users,
  Settings, CheckCircle2,
  AlertCircle, ShieldCheck, Database
} from 'lucide-react';

function SectionHeader({ icon: Icon, title, count }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
        <Icon size={16} />
      </div>
      <h4 className="font-semibold text-sm text-zinc-900 dark:text-slate-100">{title}</h4>
      {count !== undefined && (
        <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-slate-700 border border-zinc-200 dark:border-slate-600 text-zinc-600 dark:text-slate-400">
          {count}
        </span>
      )}
    </div>
  );
}

function ReviewField({ label, value }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-semibold text-zinc-500 dark:text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="text-sm font-medium text-zinc-900 dark:text-slate-100">{value || '-'}</div>
    </div>
  );
}

export default function Step7Review({ payload, onLaunch }) {
  const { name, type, goals, dataToCollect, callSettings, contacts, endCallIf } = payload;
  const rules = payload.rules || {};

  const overrideCount = (contacts || []).filter(c => c.overrides?.goals || c.overrides?.dataToCollect).length;

  const totalWeight = (dataToCollect || []).reduce((sum, item) => {
    if (item.itemType !== 'question') return sum;
    const sfs = item.fieldsToExtract || [];
    if (sfs.length > 0) return sum + sfs.reduce((s, sf) => s + (sf.weight || 0), 0);
    return sum + (item.weight || 0);
  }, 0);

  const cardCls = "rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm";

  return (
    <div className="animate-fade-in flex flex-col gap-8 pb-10">
      <div>
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-slate-100 tracking-tight">Final Review</h3>
        <p className="text-zinc-500 dark:text-slate-400 text-sm mt-1">
          Review your campaign configuration before launching the automated AI agent.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Campaign Overview */}
        <div className={cardCls}>
          <SectionHeader icon={ShieldCheck} title="Campaign Overview" />
          <div className="grid grid-cols-2 gap-6">
            <ReviewField label="Campaign Name" value={name} />
            <ReviewField label="Campaign Type" value={type} />
          </div>
        </div>

        {/* Call Settings */}
        <div className={cardCls}>
          <SectionHeader icon={Settings} title="Call Settings" />
          <div className="grid grid-cols-2 gap-y-6">
            <ReviewField label="AI Tone" value={callSettings?.tone} />
            <ReviewField label="Language" value={callSettings?.language} />
            <ReviewField label="Max Duration" value={`${callSettings?.maxDuration} mins`} />
            <ReviewField label="Retry Attempts" value={callSettings?.retryAttempts} />
          </div>
        </div>

        {/* Call Design */}
        <div className={`${cardCls} xl:col-span-2`}>
          <SectionHeader icon={PhoneCall} title="Call Design" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ReviewField label="Primary Goal" value={goals?.goal} />
            <ReviewField label="Call Introduction" value={goals?.callIntro} />
            <ReviewField label="Call Sign-off" value={goals?.callSignOff} />
            <ReviewField label="Success Score Threshold" value={`${rules.successScore ?? 50}%`} />
          </div>
        </div>

        {/* Questions & Flow */}
        <div className={`${cardCls} xl:col-span-2`}>
          <SectionHeader icon={ClipboardList} title="Questions & Flow" count={dataToCollect?.length} />
          {dataToCollect?.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                {dataToCollect.map((q, i) => {
                  const sfs = q.fieldsToExtract || [];
                  const hasSubFields = sfs.length > 0;
                  const effectiveWeight = hasSubFields
                    ? sfs.reduce((s, sf) => s + (sf.weight || 0), 0)
                    : (q.weight || 0);

                  return (
                    <div key={i} className="flex items-start gap-4 p-3 rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-900">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${q.itemType === 'question' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-violet-50 text-violet-700 border-violet-200'}`}>
                            {q.itemType}
                          </span>
                          {q.is_mandatory && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">Mandatory</span>
                          )}
                          {q.itemType === 'question' && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-slate-500">
                              Weight: {effectiveWeight}%
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-slate-100 leading-relaxed">{q.text}</p>

                        {q.itemType === 'question' && (
                          <div className="mt-2 flex flex-col gap-2">
                            <div className="flex flex-wrap gap-2 text-xs">
                              {q.scoringActiveTab === 'semantic' && q.scoringCriteria?.trim() ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-semibold shadow-sm">
                                  <strong>Semantic:</strong> {q.scoringCriteria.length > 80 ? q.scoringCriteria.slice(0, 80) + '…' : q.scoringCriteria}
                                </span>
                              ) : q.expectedAnswer && q.expectedAnswer.condition !== 'is any value' ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-slate-700 border border-zinc-300 dark:border-slate-600 text-zinc-900 dark:text-slate-100 font-semibold shadow-sm">
                                  <strong>Expected:</strong> {q.expectedAnswer.condition} "{q.expectedAnswer.value}"
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-50 dark:bg-slate-800/50 border border-zinc-200 dark:border-slate-700 text-zinc-400 dark:text-slate-500 font-medium italic">
                                  Any response accepted
                                </span>
                              )}

                              {q.onAnswer && q.onAnswer.action !== 'continue' && (() => {
                                const isSkip = q.onAnswer.action === 'skip_question';
                                const isEnd  = q.onAnswer.action === 'end_call';
                                const useSemanticSkip = q.onAnswer.skipConditionActiveTab === 'semantic';
                                const semanticText = q.onAnswer.skipSemanticCondition;
                                const cond   = q.onAnswer.skipCondition || { condition: 'contains', value: '' };
                                const hasCond = cond.condition !== 'is any value';
                                let actionText = '';
                                if (isSkip && q.onAnswer.skipToId) {
                                  const targetIdx = dataToCollect.findIndex(item => item.id === q.onAnswer.skipToId);
                                  actionText = targetIdx >= 0 ? `JUMP TO Question #${targetIdx + 1}` : 'Skip to next';
                                } else if (isEnd) {
                                  actionText = 'END CALL';
                                } else return null;
                                return (
                                  <span key="action" className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold border shadow-sm ${isEnd ? 'bg-red-50 border-red-200 text-red-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                                    ↳{' '}
                                    {useSemanticSkip && semanticText?.trim()
                                      ? <>If <strong>semantic</strong> "{semanticText.length > 60 ? semanticText.slice(0, 60) + '…' : semanticText}" → <strong className="underline">{actionText}</strong></>
                                      : hasCond
                                        ? <>If answer <strong>{cond.condition}</strong> "{cond.value}" → <strong className="underline">{actionText}</strong></>
                                        : <>Always → <strong className="underline">{actionText}</strong></>
                                    }
                                  </span>
                                );
                              })()}
                            </div>

                            {hasSubFields && (
                              <div className="flex flex-col gap-1 mt-1">
                                <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-slate-500 flex items-center gap-1">
                                  <Database size={9} /> Extract {sfs.length} field{sfs.length !== 1 ? 's' : ''}
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                  {sfs.map((sf, si) => (
                                    <span key={si} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 px-2 py-0.5 text-[11px] font-medium">
                                      {sf.field} <span className="opacity-60">({sf.type})</span> <span className="font-bold">{sf.weight}%</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Weight total */}
              <div className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-zinc-200 dark:border-slate-700 text-xs text-zinc-500 dark:text-slate-400">
                <CheckCircle2 size={13} className={totalWeight === 100 ? 'text-emerald-500' : 'text-zinc-400'} />
                Total Call Score Weight: <strong className="text-zinc-700 dark:text-slate-300">{totalWeight}%</strong>
                {totalWeight !== 100 && <span className="text-red-500 font-medium ml-1">(Weight does not sum to 100%)</span>}
              </div>

              {endCallIf && (
                <div className="p-4 rounded-xl border border-red-200 bg-red-50">
                  <div className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <AlertCircle size={11} /> Global "End Call If" Condition
                  </div>
                  <p className="text-sm text-red-800 italic">{endCallIf}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-zinc-400 dark:text-slate-500 py-4 text-center border-2 border-dashed border-zinc-200 dark:border-slate-700 rounded-xl">No specific questions defined.</p>
          )}
        </div>

        {/* Contacts */}
        <div className={`${cardCls} xl:col-span-2`}>
          <SectionHeader icon={Users} title="Audience & Personalization" count={contacts?.length} />
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-slate-700 text-zinc-600 dark:text-slate-400">
                <Users size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-slate-100">{contacts?.length} Contacts Queued</p>
                <p className="text-xs text-zinc-500 dark:text-slate-400">The bot will dial these numbers sequentially.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${overrideCount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-zinc-100 text-zinc-400'}`}>
                <CheckCircle2 size={22} />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-slate-100">{overrideCount} Overrides Set</p>
                <p className="text-xs text-zinc-500 dark:text-slate-400">Contacts with personalized call logic.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
