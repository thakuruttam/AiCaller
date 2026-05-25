import React, { useState } from 'react';
import {
  GripVertical, ChevronDown, ChevronUp, MessageSquare, Info,
  X, ArrowRight, SkipForward, PhoneOff, Database, Plus
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
    isWeightManuallySet: false,
    expectedAnswer: { condition: 'contains', value: '' },
    onAnswer: { action: 'continue', skipToId: '', skipCondition: { condition: 'contains', value: '' } },
    fieldsToExtract: [],
  };
}

const selectCls = 'h-8 rounded-md border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-1 text-xs text-zinc-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500';
const inputCls  = 'h-8 rounded-md border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 text-sm text-zinc-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500';

export function ConditionSelect({ value, onChange, className = '' }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={`${selectCls} ${className}`}>
      {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );
}

export function GenericSelect({ value, onChange, options, className = '' }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={`${selectCls} ${className}`}>
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
  const fieldsToExtract = item.fieldsToExtract || [];

  const update      = (patch) => onUpdate({ ...item, ...patch });
  const updateAns   = (patch) => update({ expectedAnswer: { ...expectedAnswer, ...patch } });
  const updateOnAns = (patch) => update({ onAnswer: { ...onAnswer, ...patch } });
  const updateSkip  = (patch) => update({ onAnswer: { ...onAnswer, skipCondition: { ...onAnswer.skipCondition, ...patch } } });

  const addSubField = () => {
    update({
      fieldsToExtract: [
        ...fieldsToExtract,
        { id: uid(), field: '', type: 'string', unit: '', weight: 0, isWeightManuallySet: false }
      ]
    });
  };

  const updateSubField = (sfId, patch) => {
    update({ fieldsToExtract: fieldsToExtract.map(sf => sf.id === sfId ? { ...sf, ...patch } : sf) });
  };

  const removeSubField = (sfId) => {
    update({ fieldsToExtract: fieldsToExtract.filter(sf => sf.id !== sfId) });
  };

  const hasSubFields = fieldsToExtract.length > 0;

  return (
    <div
      className={`rounded-xl border bg-white dark:bg-slate-800 shadow-sm transition-all ${isDraggedOver ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-zinc-200 dark:border-slate-700'}`}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => { e.preventDefault(); onDragOver(index); }}
      onDrop={() => onDrop(index)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-slate-700 select-none">
        <span className="cursor-grab text-zinc-400 dark:text-slate-500 hover:text-zinc-600 dark:hover:text-slate-400 transition-colors" title="Drag to reorder">
          <GripVertical size={16} />
        </span>
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">
          {index + 1}
        </span>

        {/* Type toggle */}
        <div className="flex bg-zinc-100 dark:bg-slate-700 p-0.5 rounded-lg border border-zinc-200 dark:border-slate-600 text-xs">
          <button type="button" onClick={() => update({ itemType: 'question' })}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${item.itemType === 'question' ? 'bg-white dark:bg-slate-600 shadow-sm text-zinc-900 dark:text-slate-100' : 'text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-300'}`}>
            <MessageSquare size={11} /> Question
          </button>
          <button type="button" onClick={() => update({ itemType: 'information' })}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${item.itemType === 'information' ? 'bg-white dark:bg-slate-600 shadow-sm text-zinc-900 dark:text-slate-100' : 'text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-300'}`}>
            <Info size={11} /> Information
          </button>
        </div>

        {item.is_mandatory && (
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 text-violet-700 px-2 py-0.5 text-xs font-medium">
            Mandatory
          </span>
        )}

        {hasSubFields && (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium">
            <Database size={10} /> {fieldsToExtract.length} field{fieldsToExtract.length !== 1 ? 's' : ''}
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <button type="button" onClick={() => setExpanded(v => !v)} className="p-1 text-zinc-400 dark:text-slate-500 hover:text-zinc-700 dark:hover:text-slate-300 transition-colors rounded-md">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button type="button" onClick={onRemove} className="p-1 text-zinc-400 dark:text-slate-500 hover:text-red-500 transition-colors rounded-md">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-4 flex flex-col gap-4">
          {/* Text */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-500 dark:text-slate-400">
              {item.itemType === 'question' ? 'Question text' : 'Information to convey'}
            </label>
            <textarea rows={2} value={item.text}
              onChange={e => update({ text: e.target.value })}
              placeholder={item.itemType === 'question'
                ? 'e.g. What is your current CTC?'
                : 'e.g. This call is regarding your pending EMI of ₹5,000.'}
              className={`w-full rounded-lg border bg-white dark:bg-slate-700 px-3 py-2 text-sm text-zinc-900 dark:text-slate-100 placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 resize-y transition-colors ${
                item.itemType === 'question' && !item.text?.trim()
                  ? 'border-red-400 focus:ring-red-500/20 focus:border-red-400'
                  : 'border-zinc-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-indigo-500/20'
              }`} />
            {item.itemType === 'question' && !item.text?.trim() && (
              <p className="text-xs text-red-500 mt-0.5">Question text is required — the bot will skip this item.</p>
            )}
          </div>

          {/* Question-only fields */}
          {item.itemType === 'question' && (
            <>
              {/* Expected answer */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-500 dark:text-slate-400">Expected answer</label>
                <div className="flex gap-2 flex-wrap">
                  <ConditionSelect value={expectedAnswer.condition} onChange={v => updateAns({ condition: v })} className="w-40" />
                  {expectedAnswer.condition !== 'is any value' && (
                    <input type="text" value={expectedAnswer.value}
                      onChange={e => updateAns({ value: e.target.value })}
                      placeholder="Expected value…"
                      className={`flex-1 min-w-[160px] ${inputCls}`} />
                  )}
                </div>
              </div>

              {/* On Answer action */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-zinc-500 dark:text-slate-400">Action after answer</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'continue',      label: 'Continue',      icon: ArrowRight },
                    { value: 'skip_question', label: 'Skip Question', icon: SkipForward },
                    { value: 'end_call',      label: 'End Call',      icon: PhoneOff },
                  ].map(({ value, label, icon: Icon }) => (
                    <button key={value} type="button" onClick={() => updateOnAns({ action: value })}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border px-3 py-1.5 transition-all
                        ${onAnswer.action === value
                          ? value === 'end_call'
                            ? 'border-red-400 bg-red-50 text-red-700'
                            : 'border-indigo-400 bg-indigo-50 text-indigo-700'
                          : 'border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-zinc-500 dark:text-slate-400 hover:bg-zinc-50 dark:hover:bg-slate-700/50'}`}>
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </div>

                {/* Skip / end-call details */}
                {(onAnswer.action === 'skip_question' || onAnswer.action === 'end_call') && (
                  <div className="flex flex-col gap-2 mt-1 p-3 rounded-lg border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-900">
                    <p className="text-xs text-zinc-500 dark:text-slate-400 font-medium">
                      {onAnswer.action === 'end_call' ? 'End call condition' : 'Skip condition'} — if current answer…
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <ConditionSelect value={onAnswer.skipCondition.condition} onChange={v => updateSkip({ condition: v })} className="w-40" />
                      {onAnswer.skipCondition.condition !== 'is any value' && (
                        <input type="text" value={onAnswer.skipCondition.value}
                          onChange={e => updateSkip({ value: e.target.value })}
                          placeholder="condition value…"
                          className={`flex-1 min-w-[140px] ${inputCls}`} />
                      )}
                    </div>
                    {onAnswer.action === 'skip_question' && (
                      <>
                        <p className="text-xs text-zinc-500 dark:text-slate-400 font-medium mt-1">Then JUMP directly to:</p>
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

              {/* Fields to Extract */}
              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-100 dark:border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-zinc-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Database size={12} className="text-indigo-600" /> Fields to Extract
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-slate-500">
                      {hasSubFields
                        ? 'Each sub-field weight counts toward the call score when that value is extracted'
                        : 'Default: extracts the full answer. Add specific fields for per-field weight scoring.'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={addSubField}
                    className="inline-flex items-center gap-1 rounded-md border border-dashed border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-2.5 py-1 text-xs font-medium transition-colors"
                  >
                    <Plus size={11} /> Add Field
                  </button>
                </div>

                {hasSubFields && (
                  <div className="flex flex-col gap-2">
                    {fieldsToExtract.map((sf) => (
                      <div key={sf.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-900">
                        <input
                          type="text"
                          value={sf.field}
                          onChange={e => updateSubField(sf.id, { field: e.target.value })}
                          placeholder="Field name (e.g. notice_period)"
                          className="flex-1 h-7 rounded-md border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 text-xs text-zinc-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500"
                        />
                        <select
                          value={sf.type}
                          onChange={e => updateSubField(sf.id, { type: e.target.value })}
                          className="h-7 rounded-md border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 text-xs text-zinc-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                        >
                          <option value="string">Text</option>
                          <option value="number">Number</option>
                          <option value="boolean">Yes/No</option>
                          <option value="array">List</option>
                        </select>
                        <input
                          type="text"
                          value={sf.unit || ''}
                          onChange={e => updateSubField(sf.id, { unit: e.target.value })}
                          placeholder="Unit (e.g. years)"
                          className="w-24 h-7 rounded-md border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 text-xs text-zinc-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number" min={0} max={100}
                            value={sf.weight ?? 0}
                            onChange={e => updateSubField(sf.id, {
                              weight: Math.min(100, Math.max(0, Number(e.target.value))),
                              isWeightManuallySet: true
                            })}
                            className="w-12 h-7 rounded-md border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-1 text-xs text-center tabular-nums text-zinc-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500/30"
                          />
                          <span className="text-xs text-zinc-400 dark:text-slate-500">%</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSubField(sf.id)}
                          className="p-1 text-zinc-400 dark:text-slate-500 hover:text-red-500 transition-colors rounded"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mandatory + Weight */}
              <div className="flex items-center justify-between gap-6 pt-2 border-t border-zinc-100 dark:border-slate-700/50 flex-wrap">
                <div className="flex items-center justify-between flex-1 min-w-[200px]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-zinc-700 dark:text-slate-300">Mandatory</span>
                    <span className="text-xs text-zinc-400 dark:text-slate-500">Bot retries if no valid answer received</span>
                  </div>
                  <button type="button" role="switch" aria-checked={item.is_mandatory}
                    onClick={() => update({ is_mandatory: !item.is_mandatory })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${item.is_mandatory ? 'bg-indigo-600' : 'bg-zinc-300'}`}>
                    <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${item.is_mandatory ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-zinc-700 dark:text-slate-300 text-right">Call Score Weight</span>
                    <span className="text-xs text-zinc-400 dark:text-slate-500">
                      {hasSubFields ? 'Sub-fields split this equally' : 'Contribution to success score'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="number" min={0} max={100} value={item.weight ?? 0}
                      onChange={e => update({
                        weight: Math.min(100, Math.max(0, Number(e.target.value))),
                        isWeightManuallySet: true,
                        fieldsToExtract: (item.fieldsToExtract || []).map(sf => ({ ...sf, isWeightManuallySet: false }))
                      })}
                      className="w-16 h-8 rounded-lg border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 text-sm text-center tabular-nums text-zinc-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
                    <span className="text-xs text-zinc-400 dark:text-slate-500 font-medium">%</span>
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
