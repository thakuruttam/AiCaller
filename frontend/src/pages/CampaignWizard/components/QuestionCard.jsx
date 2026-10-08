import React, { useState } from 'react';
import { CONDITIONS, uid } from './questionModel';
import { Button, IconButton, Tabs } from '../../../components/ui';
import {
  GripVertical, ChevronDown, ChevronUp, MessageSquare, Info,
  X, ArrowRight, SkipForward, PhoneOff, Database, Plus, Brain
} from 'lucide-react';

const selectCls = 'h-8 rounded-field border border-paper-600 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 px-2 py-1 text-xs text-ink-100 dark:text-paper-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500';
const inputCls  = 'h-8 rounded-field border border-paper-600 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 px-3 text-sm text-ink-100 dark:text-paper-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500';

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
  const [answerTab, setAnswerTab] = useState(item.scoringActiveTab || 'condition');
  const [skipConditionTab, setSkipConditionTab] = useState(item.onAnswer?.skipConditionActiveTab || 'condition');

  const expectedAnswer = item.expectedAnswer || { condition: 'is any value', value: '' };
  const scoringCriteria = item.scoringCriteria || '';
  const onAnswer = {
    action: 'continue', skipToId: '',
    ...item.onAnswer,
    skipCondition: item.onAnswer?.skipCondition || { condition: 'contains', value: '' }
  };
  const skipSemanticCondition = onAnswer.skipSemanticCondition || '';

  const handleAnswerTabChange = (tab) => {
    setAnswerTab(tab);
    update({ scoringActiveTab: tab });
  };

  const handleSkipConditionTabChange = (tab) => {
    setSkipConditionTab(tab);
    updateOnAns({ skipConditionActiveTab: tab });
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
      className={`bg-card dark:bg-muted rounded-2xl shadow-primary transition-all ${isDraggedOver ? 'ring-1 ring-brand-300' : ''}`}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => { e.preventDefault(); onDragOver(index); }}
      onDrop={() => onDrop(index)}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-paper-500 dark:border-ink-400 select-none">
        <span className="cursor-grab text-ink-800 dark:text-ink-800 hover:text-ink-600 dark:hover:text-ink-800 transition-colors" title="Drag to reorder">
          <GripVertical size={16} />
        </span>
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-500 text-white text-xs font-bold shrink-0">
          {index + 1}
        </span>

        {/* Type toggle */}
        <div className="flex bg-paper-400 dark:bg-ink-300 p-0.5 rounded-control border border-paper-500 dark:border-ink-400 text-xs">
          <Button variant="ghost" size="sm" type="button" onClick={() => update({ itemType: 'question' })}>
            <MessageSquare size={11} /> Question
          </Button>
          <Button variant="ghost" size="sm" type="button" onClick={() => update({ itemType: 'information' })}>
            <Info size={11} /> Information
          </Button>
        </div>

        {item.is_mandatory && (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-100 text-brand-600 px-2 py-0.5 text-xs font-medium">
            Mandatory
          </span>
        )}

        {hasSubFields && (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-100 text-brand-600 px-2 py-0.5 text-xs font-medium">
            <Database size={10} /> {fieldsToExtract.length} field{fieldsToExtract.length !== 1 ? 's' : ''}
          </span>
        )}

        {scoringCriteria.trim() && (
          <span className="inline-flex items-center gap-1 rounded-full border border-positive/30 bg-positive/10 text-positive-dim dark:border-positive/15 dark:bg-positive/15 dark:text-positive px-2 py-0.5 text-xs font-medium">
            <Brain size={10} /> Semantic
          </span>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="md" type="button" onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
          <Button variant="dangerGhost" size="md" type="button" onClick={onRemove}>
            <X size={16} />
          </Button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-4 flex flex-col gap-4">
          {/* Text */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-700 dark:text-ink-900">
              {item.itemType === 'question' ? 'Question text' : 'Information to convey'}
            </label>
            <textarea rows={2} value={item.text}
              onChange={e => update({ text: e.target.value })}
              placeholder={item.itemType === 'question'
                ? 'e.g. What is your current CTC?'
                : 'e.g. This call is regarding your pending EMI of ₹5,000.'}
              className={`w-full rounded-control border bg-paper-100 dark:bg-ink-300 px-3 py-2 text-sm text-ink-100 dark:text-paper-200 placeholder:text-ink-800 dark:placeholder:text-ink-700 focus:outline-none focus:ring-2 resize-y transition-colors ${
                item.itemType === 'question' && !item.text?.trim()
                  ? 'border-negative focus:ring-negative/20 focus:border-negative'
                  : 'border-paper-600 dark:border-ink-400 focus:border-brand-500 focus:ring-brand-500/20'
              }`} />
            {item.itemType === 'question' && !item.text?.trim() && (
              <p className="text-xs font-medium text-negative mt-0.5">Question text is required — the bot will skip this item.</p>
            )}
          </div>

          {/* Question-only fields */}
          {item.itemType === 'question' && (
            <>
              {/* Expected answer — Condition | Semantic tabs */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-ink-700 dark:text-ink-900">Expected answer</label>
                  <Tabs
                    size="sm"
                    value={answerTab}
                    onChange={handleAnswerTabChange}
                    items={[
                      { value: 'condition', label: 'Condition', icon: 'rule' },
                      { value: 'semantic', label: 'Semantic', icon: 'psychology' },
                    ]}
                  />
                </div>

                {answerTab === 'condition' && (
                  <div className="flex gap-2 flex-wrap">
                    <ConditionSelect value={expectedAnswer.condition} onChange={v => updateAns({ condition: v })} className="w-40" />
                    {expectedAnswer.condition !== 'is any value' && (
                      <input type="text" value={expectedAnswer.value}
                        onChange={e => updateAns({ value: e.target.value })}
                        placeholder="Expected value…"
                        className={`flex-1 min-w-[160px] ${inputCls}`} />
                    )}
                  </div>
                )}

                {answerTab === 'semantic' && (
                  <div className="flex flex-col gap-1.5">
                    <textarea
                      rows={3}
                      value={scoringCriteria}
                      onChange={e => update({ scoringCriteria: e.target.value })}
                      placeholder={"Describe what a good answer looks like in plain English.\n\ne.g. Should have an engineering degree and Node.js experience. Give 0 if no experience, proportional marks for 1–4 years, full marks for 5+ years."}
                      className="w-full rounded-control border border-paper-600 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 px-3 py-2 text-sm text-ink-100 dark:text-paper-200 placeholder:text-ink-800 dark:placeholder:text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-y"
                    />
                    <p className="text-xs font-medium text-ink-800 dark:text-ink-800">
                      AI uses this to score the answer in reports. Describe criteria and scoring thresholds in plain English. This tab must stay selected for it to govern scoring — switching back to Condition uses that rule instead, even if this is filled in.
                    </p>
                  </div>
                )}
              </div>

              {/* On Answer action */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-ink-700 dark:text-ink-900">Action after answer</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'continue',      label: 'Continue',      icon: ArrowRight },
                    { value: 'skip_question', label: 'Skip Question', icon: SkipForward },
                    { value: 'end_call',      label: 'End Call',      icon: PhoneOff },
                  ].map((opt) => {
                    const ActionIcon = opt.icon;
                    const { value, label } = opt;
                    return (
                    <Button
                      key={value}
                      type="button"
                      size="sm"
                      variant={onAnswer.action === value ? 'primary' : 'secondary'}
                      aria-pressed={onAnswer.action === value}
                      onClick={() => updateOnAns({ action: value })}
                    >
                      <ActionIcon size={12} /> {label}
                    </Button>
                    );
                  })}
                </div>

                {/* Skip / end-call details */}
                {(onAnswer.action === 'skip_question' || onAnswer.action === 'end_call') && (
                  <div className="flex flex-col gap-2 mt-1 p-3 rounded-control border border-paper-500 dark:border-ink-400 bg-paper-200 dark:bg-ink-50">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-ink-700 dark:text-ink-900 font-medium">
                        {onAnswer.action === 'end_call' ? 'End call condition' : 'Skip condition'} — if current answer…
                      </p>
                      <Tabs
                        size="sm"
                        value={skipConditionTab}
                        onChange={handleSkipConditionTabChange}
                        items={[
                          { value: 'condition', label: 'Condition', icon: 'rule' },
                          { value: 'semantic', label: 'Semantic', icon: 'psychology' },
                        ]}
                      />
                    </div>

                    {skipConditionTab === 'condition' && (
                      <div className="flex gap-2 flex-wrap">
                        <ConditionSelect value={onAnswer.skipCondition.condition} onChange={v => updateSkip({ condition: v })} className="w-40" />
                        {onAnswer.skipCondition.condition !== 'is any value' && (
                          <input type="text" value={onAnswer.skipCondition.value}
                            onChange={e => updateSkip({ value: e.target.value })}
                            placeholder="condition value…"
                            className={`flex-1 min-w-[140px] ${inputCls}`} />
                        )}
                      </div>
                    )}

                    {skipConditionTab === 'semantic' && (
                      <div className="flex flex-col gap-1.5">
                        <textarea
                          rows={2}
                          value={skipSemanticCondition}
                          onChange={e => updateOnAns({ skipSemanticCondition: e.target.value })}
                          placeholder={onAnswer.action === 'end_call'
                            ? 'e.g. If user says they are not interested or busy'
                            : 'e.g. If user has less than 2 years of experience'}
                          className="w-full rounded-control border border-paper-600 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 px-3 py-2 text-sm text-ink-100 dark:text-paper-200 placeholder:text-ink-800 dark:placeholder:text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-y"
                        />
                        <p className="text-xs font-medium text-ink-800 dark:text-ink-800">
                          AI evaluates this live during the call against the user's answer.
                        </p>
                      </div>
                    )}

                    {onAnswer.action === 'skip_question' && (
                      <>
                        <p className="text-xs text-ink-700 dark:text-ink-900 font-medium mt-1">Then JUMP directly to:</p>
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
              <div className="flex flex-col gap-2 pt-2 border-t border-paper-400 dark:border-ink-400/50">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-ink-500 dark:text-ink-900 flex items-center gap-1.5">
                      <Database size={12} className="text-brand-500" /> Fields to Extract
                    </span>
                    <span className="text-xs font-medium text-ink-800 dark:text-ink-800">
                      {hasSubFields
                        ? 'Each sub-field weight counts toward the call score when that value is extracted'
                        : 'Default: extracts the full answer. Add specific fields for per-field weight scoring.'}
                    </span>
                  </div>
                  <Button variant="subtle" size="sm" type="button" onClick={addSubField}>
                    <Plus size={11} /> Add Field
                  </Button>
                </div>

                {hasSubFields && (
                  <div className="flex flex-col gap-2">
                    {fieldsToExtract.map((sf) => (
                      <div key={sf.id} className="flex items-center gap-2 p-2.5 rounded-control border border-paper-500 dark:border-ink-400 bg-paper-200 dark:bg-ink-50">
                        <input
                          type="text"
                          value={sf.field}
                          onChange={e => updateSubField(sf.id, { field: e.target.value })}
                          placeholder="Field name (e.g. notice_period)"
                          className="flex-1 h-7 rounded-field border border-paper-600 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 px-2 text-xs text-ink-100 dark:text-paper-200 focus:outline-none focus:ring-1 focus:ring-brand-500/30 focus:border-brand-500"
                        />
                        <select
                          value={sf.type}
                          onChange={e => updateSubField(sf.id, { type: e.target.value })}
                          className="h-7 rounded-field border border-paper-600 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 px-2 text-xs text-ink-100 dark:text-paper-200 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
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
                          className="w-24 h-7 rounded-field border border-paper-600 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 px-2 text-xs text-ink-100 dark:text-paper-200 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number" min={0} max={100}
                            value={sf.weight ?? 0}
                            onChange={e => updateSubField(sf.id, {
                              weight: Math.min(100, Math.max(0, Number(e.target.value))),
                              isWeightManuallySet: true
                            })}
                            className="w-12 h-7 rounded-field border border-paper-600 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 px-1 text-xs text-center tabular-nums text-ink-100 dark:text-paper-200 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                          />
                          <span className="text-xs font-medium text-ink-800 dark:text-ink-800">%</span>
                        </div>
                        <Button variant="dangerGhost" size="md" type="button" onClick={() => removeSubField(sf.id)}>
                          <X size={13} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mandatory + Weight */}
              <div className="flex items-center justify-between gap-6 pt-2 border-t border-paper-400 dark:border-ink-400/50 flex-wrap">
                <div className="flex items-center justify-between flex-1 min-w-[200px]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-ink-500 dark:text-ink-900">Mandatory</span>
                    <span className="text-xs font-medium text-ink-800 dark:text-ink-800">Bot retries if no valid answer received</span>
                  </div>
                  <Button variant="primary" size="md" type="button" role="switch" aria-checked={item.is_mandatory} onClick={() => update({ is_mandatory: !item.is_mandatory })}>
                    <span className={`pointer-events-none block h-4 w-4 rounded-full bg-paper-100 shadow-raised ring-0 transition-transform ${item.is_mandatory ? 'translate-x-4' : 'translate-x-0'}`} />
                  </Button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-ink-500 dark:text-ink-900 text-right">Call Score Weight</span>
                    <span className="text-xs font-medium text-ink-800 dark:text-ink-800">
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
                      className="w-16 h-8 rounded-control border border-paper-600 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 px-2 text-sm text-center tabular-nums text-ink-100 dark:text-paper-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" />
                    <span className="text-xs font-medium text-ink-800 dark:text-ink-800 font-medium">%</span>
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
