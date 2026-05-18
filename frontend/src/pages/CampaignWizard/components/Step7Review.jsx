import React from 'react';
import {
  Rocket, ClipboardList, PhoneCall, Users,
  MessageSquare, Settings, CheckCircle2,
  AlertCircle, ShieldCheck, Building2, UserCircle2
} from 'lucide-react';

function SectionHeader({ icon: Icon, title, count }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="p-2 rounded-lg bg-primary/10 text-primary">
        <Icon size={18} />
      </div>
      <h4 className="font-semibold text-base">{title}</h4>
      {count !== undefined && (
        <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-muted border border-border">
          {count}
        </span>
      )}
    </div>
  );
}

function ReviewField({ label, value, icon: Icon }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {Icon && <Icon size={12} />}
        {label}
      </div>
      <div className="text-sm font-medium">{value || '-'}</div>
    </div>
  );
}

export default function Step7Review({ payload, onLaunch }) {
  const {
    name, type, goals, dataToCollect,
    callSettings, contacts, endCallIf
  } = payload;

  const overrideCount = contacts.filter(c => c.overrides?.goals || c.overrides?.dataToCollect).length;
  const totalWeight = dataToCollect?.reduce((sum, i) => sum + (i.weight || 0), 0) || 0;
  
  const rules = payload.rules || {};
  const fieldsToExtract = rules.fieldsToExtract || [];
  const scoringRules = rules.scoringRules || [];

  return (
    <div className="animate-fade-in flex flex-col gap-8 pb-10">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight">Final Review</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Review your campaign configuration before launching the automated AI agent.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* ── Campaign Overview ── */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <SectionHeader icon={ShieldCheck} title="Campaign Overview" />
          <div className="grid grid-cols-2 gap-6">
            <ReviewField label="Campaign Name" value={name} />
            <ReviewField label="Campaign Type" value={type} />
          </div>
        </div>

        {/* ── Call Settings ── */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <SectionHeader icon={Settings} title="Call Settings" />
          <div className="grid grid-cols-2 gap-y-6">
            <ReviewField label="AI Tone" value={callSettings?.tone} />
            <ReviewField label="Language" value={callSettings?.language} />
            <ReviewField label="Max Duration" value={`${callSettings?.maxDuration} mins`} />
            <ReviewField label="Retry attempts" value={callSettings?.retryAttempts} />
          </div>
        </div>

        {/* ── Call Design (Goals) ── */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm xl:col-span-2">
          <SectionHeader icon={PhoneCall} title="Call Design" />
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ReviewField label="Primary Goal" value={goals?.goal} />
              <ReviewField label="Call Introduction" value={goals?.callIntro} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ReviewField label="Call Sign-off" value={goals?.callSignOff} />
              <div className="flex flex-col gap-2">
                 <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Courtesy Close</div>
                 <div className="flex items-center gap-2 text-sm font-medium">
                   {goals?.courtesyClose ? (
                     <><CheckCircle2 size={16} className="text-green-500" /> Enabled</>
                   ) : (
                     <><AlertCircle size={16} className="text-muted-foreground" /> Disabled</>
                   )}
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Questions & Flow ── */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm xl:col-span-2">
          <SectionHeader icon={ClipboardList} title="Questions & Flow" count={dataToCollect?.length} />
          {dataToCollect?.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                {dataToCollect.map((q, i) => (
                  <div key={i} className="flex items-start gap-4 p-3 rounded-xl border border-border bg-muted/20">
                    <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${q.itemType === 'question' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>
                          {q.itemType}
                        </span>
                        {q.is_mandatory && <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">Mandatory</span>}
                        {q.itemType === 'question' && <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Weight: {q.weight}%</span>}
                      </div>
                      <p className="text-sm font-medium leading-relaxed">{q.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl border border-dashed text-xs text-muted-foreground">
                <CheckCircle2 size={14} className={totalWeight === 100 ? 'text-green-500' : 'text-muted-foreground'} />
                Total Call Score Weight: <strong className="text-foreground">{totalWeight}%</strong>
                {totalWeight !== 100 && <span className="text-destructive font-medium ml-1">(Notice: Weight does not sum to 100%)</span>}
              </div>
              {endCallIf && (
                <div className="mt-4 p-4 rounded-xl border border-destructive/20 bg-destructive/5">
                  <div className="text-xs font-semibold text-destructive uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <AlertCircle size={12} /> Global "End Call If" Condition
                  </div>
                  <p className="text-sm italic">{endCallIf}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center border-2 border-dashed rounded-xl">No specific questions defined.</p>
          )}
        </div>

        {/* ── Evaluation Rules ── */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm xl:col-span-2">
          <SectionHeader icon={ClipboardList} title="Evaluation & Scoring" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Fields to Extract ({fieldsToExtract.length})
              </div>
              {fieldsToExtract.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {fieldsToExtract.map((f, i) => (
                    <li key={i} className="text-sm p-2 bg-muted/20 border rounded-lg flex items-center justify-between">
                      <span className="font-medium">{f.field}</span>
                      <span className="text-xs text-muted-foreground">{f.type} {f.unit ? `(${f.unit})` : ''}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-muted-foreground italic">No fields defined.</div>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Scoring Rules ({scoringRules.length})
              </div>
              {scoringRules.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {scoringRules.map((r, i) => (
                    <li key={i} className="text-sm p-2 bg-muted/20 border rounded-lg flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{r.field} <span className="text-muted-foreground font-normal italic">{r.condition}</span> {r.value}</span>
                        <span className="text-xs font-bold text-green-600">+{r.score}</span>
                      </div>
                      {r.label && <span className="text-xs text-muted-foreground">{r.label}</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-muted-foreground italic">No scoring rules defined.</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Contacts ── */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm xl:col-span-2">
          <SectionHeader icon={Users} title="Audience & Personalization" count={contacts?.length} />
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-secondary text-secondary-foreground">
                <Users size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold">{contacts?.length} Contacts Queued</p>
                <p className="text-xs text-muted-foreground">The bot will dial these numbers sequentially.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${overrideCount > 0 ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-muted text-muted-foreground'}`}>
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-sm font-semibold">{overrideCount} Overrides Set</p>
                <p className="text-xs text-muted-foreground">Contacts with personalized call logic.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
