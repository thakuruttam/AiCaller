// Shared QuestionCard component — used by Step4 and the Contact Overrides modal
import React, { useState } from 'react';
import {
  GripVertical, ChevronDown, ChevronUp, MessageSquare, Info,
  X, ArrowRight, SkipForward, PhoneOff
} from 'lucide-react';

export const CONDITIONS = [
  'contains', 'does not contain', 'equals', 'starts with', 'ends with',
  'is greater than', 'is less than', 'is any value'
];

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function emptyItem(order) {
  return {
    id: uid(),
    order,
    itemType: 'question',
    text: '',
    is_mandatory: false,
    weight: 0,
    expectedAnswer: { condition: 'contains', value: '' },
    onAnswer: { action: 'continue', skipToId: '', skipCondition: { condition: 'contains', value: '' } },
  };
}

export function ConditionSelect({ value, onChange, className = '' }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}>
      {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

export function GenericSelect({ value, onChange, options, className = '' }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`h-8 rounded-md border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}>
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  );
}

export default function QuestionCard({
  item, allItems, index,
  onUpdate, onRemove,
  onDragStart, onDragOver, onDrop,
  isDraggedOver
}) {
  const [expanded, setExpanded] = useState(true);

  const expectedAnswer = item.expectedAnswer || { condition: 'contains', value: '' };
  const onAnswer = { 
    action: 'continue', skipToId: '', 
    ...item.onAnswer,
    skipCondition: item.onAnswer?.skipCondition || { condition: 'contains', value: '' }
  };

  const update      = (patch) => onUpdate({ ...item, ...patch });
  const updateAns   = (patch) => update({ expectedAnswer: { ...expectedAnswer, ...patch } });
  const updateOnAns = (patch) => update({ onAnswer: { ...onAnswer, ...patch } });
  const updateSkip  = (patch) => update({ onAnswer: { ...onAnswer, skipCondition: { ...onAnswer.skipCondition, ...patch } } });

  const others = allItems.filter(i => i.id !== item.id);

  return (
    <div
      className={`rounded-xl border bg-card text-card-foreground shadow-sm transition-all ${isDraggedOver ? 'border-primary ring-1 ring-primary' : 'border-border'}`}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => { e.preventDefault(); onDragOver(index); }}
      onDrop={() => onDrop(index)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border select-none">
        <span className="cursor-grab text-muted-foreground hover:text-foreground transition-colors" title="Drag to reorder">
          <GripVertical size={16} />
        </span>
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
          {index + 1}
        </span>

        {/* Type toggle */}
        <div className="flex bg-muted/40 p-0.5 rounded-lg border text-xs">
          <button type="button" onClick={() => update({ itemType: 'question' })}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${item.itemType === 'question' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <MessageSquare size={11} /> Question
          </button>
          <button type="button" onClick={() => update({ itemType: 'information' })}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${item.itemType === 'information' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <Info size={11} /> Information
          </button>
        </div>

        {item.is_mandatory && (
          <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 text-purple-700 px-2 py-0.5 text-xs font-medium dark:bg-purple-900/20 dark:text-purple-300">
            Mandatory
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <button type="button" onClick={() => setExpanded(v => !v)} className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-md">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button type="button" onClick={onRemove} className="p-1 text-muted-foreground hover:text-destructive transition-colors rounded-md">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-4 flex flex-col gap-4">
          {/* Text */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {item.itemType === 'question' ? 'Question text' : 'Information to convey'}
            </label>
            <textarea rows={2} value={item.text}
              onChange={e => update({ text: e.target.value })}
              placeholder={item.itemType === 'question'
                ? 'e.g. What is your current CTC?'
                : 'e.g. This call is regarding your pending EMI of ₹5,000.'}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y" />
          </div>

          {/* Question-only fields */}
          {item.itemType === 'question' && (
            <>
              {/* Expected answer */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">Expected answer</label>
                <div className="flex gap-2 flex-wrap">
                  <ConditionSelect value={expectedAnswer.condition} onChange={v => updateAns({ condition: v })} className="w-40" />
                  {expectedAnswer.condition !== 'is any value' && (
                    <input type="text" value={expectedAnswer.value}
                      onChange={e => updateAns({ value: e.target.value })}
                      placeholder="Expected value…"
                      className="flex-1 min-w-[160px] h-8 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  )}
                </div>
              </div>

              {/* On Answer action */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">Action after answer</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'continue',      label: 'Continue',      icon: ArrowRight },
                    { value: 'skip_question', label: 'Skip Question', icon: SkipForward },
                    { value: 'end_call',      label: 'End Call',      icon: PhoneOff },
                  ].map(({ value, label, icon: Icon }) => (
                    <button key={value} type="button" onClick={() => updateOnAns({ action: value })}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border px-3 py-1.5 transition-all
                        ${onAnswer.action === value
                          ? value === 'end_call' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-primary bg-primary/10 text-primary'
                          : 'border-input bg-background text-muted-foreground hover:bg-accent'}`}>
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </div>

                {/* Skip details */}
                {(onAnswer.action === 'skip_question' || onAnswer.action === 'end_call') && (
                  <div className="flex flex-col gap-2 mt-1 p-3 rounded-lg border border-border bg-muted/20">
                    <p className="text-xs text-muted-foreground font-medium">
                      {onAnswer.action === 'end_call' ? 'End call condition' : 'Skip condition'} — if current answer…
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <ConditionSelect value={onAnswer.skipCondition.condition} onChange={v => updateSkip({ condition: v })} className="w-40" />
                      {onAnswer.skipCondition.condition !== 'is any value' && (
                        <input type="text" value={onAnswer.skipCondition.value}
                          onChange={e => updateSkip({ value: e.target.value })}
                          placeholder="condition value…"
                          className="flex-1 min-w-[140px] h-8 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                      )}
                    </div>
                    {onAnswer.action === 'skip_question' && (
                      <>
                        <p className="text-xs text-muted-foreground font-medium mt-1">Then JUMP directly to:</p>
                        <GenericSelect
                          value={onAnswer.skipToId}
                          onChange={v => updateOnAns({ skipToId: v })}
                          options={[
                            { value: '', label: '— select question —' },
                            ...allItems.slice(index + 1).map(q => ({
                              value: q.id,
                              label: `#${allItems.findIndex(a => a.id === q.id) + 1} — ${q.text?.slice(0, 50) || 'Untitled'}`
                            }))
                          ]}
                          className="w-full"
                        />
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Mandatory + Weight */}
              <div className="flex items-center justify-between gap-6 pt-2 border-t border-border flex-wrap">
                <div className="flex items-center justify-between flex-1 min-w-[200px]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium">Mandatory</span>
                    <span className="text-xs text-muted-foreground">Bot retries if no valid answer received</span>
                  </div>
                  <button type="button" role="switch" aria-checked={item.is_mandatory}
                    onClick={() => update({ is_mandatory: !item.is_mandatory })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${item.is_mandatory ? 'bg-primary' : 'bg-input'}`}>
                    <span className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${item.is_mandatory ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-right">Call Score Weight</span>
                    <span className="text-xs text-muted-foreground">Contribution to success score</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} max={100} value={item.weight ?? 0}
                      onChange={e => update({ weight: Math.min(100, Math.max(0, Number(e.target.value))) })}
                      className="w-16 h-8 rounded-md border border-input bg-background px-2 text-sm text-center tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    <span className="text-xs text-muted-foreground font-medium">%</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
