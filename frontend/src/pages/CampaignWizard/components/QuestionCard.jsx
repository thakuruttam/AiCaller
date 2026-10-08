import React, { useState } from 'react';
import { CONDITIONS, uid } from './questionModel';
import { Button, IconButton, Tabs, Badge, Field, Input, Select, Textarea } from '../../../components/ui';
import ToggleSwitch from '../../../components/ToggleSwitch';
import {
  GripVertical, ChevronDown, ChevronUp,
  X, ArrowRight, SkipForward, PhoneOff, Database, Plus, Brain
} from 'lucide-react';

// Rule rows inside a question card are denser than a form, so their controls
// use the 32px (Button sm) height rather than the default 36px.
const DENSE = '!h-8 !text-xs';

export function ConditionSelect({ value, onChange, className = '', ...props }) {
  return (
    <Select value={value} onChange={e => onChange(e.target.value)} className={`${DENSE} ${className}`} {...props}>
      {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
    </Select>
  );
}

export function GenericSelect({ value, onChange, options, className = '', ...props }) {
  return (
    <Select value={value} onChange={e => onChange(e.target.value)} className={`${DENSE} ${className}`} {...props}>
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </Select>
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
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border select-none">
        <span className="cursor-grab text-muted-foreground hover:text-foreground transition-colors" title="Drag to reorder">
          <GripVertical size={16} />
        </span>
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-brand-450 to-brand-800 text-white text-xs font-semibold shrink-0">
          {index + 1}
        </span>

        {/* Type toggle */}
        <Tabs
          size="sm"
          value={item.itemType}
          onChange={(itemType) => update({ itemType })}
          items={[
            { value: 'question', label: 'Question', icon: 'chat' },
            { value: 'information', label: 'Information', icon: 'info' },
          ]}
        />

        {item.is_mandatory && (
          <Badge tone="brand" capitalize={false}>Mandatory</Badge>
        )}

        {hasSubFields && (
          <Badge tone="brand" dot={false} capitalize={false}>
            <Database size={10} /> {fieldsToExtract.length} field{fieldsToExtract.length !== 1 ? 's' : ''}
          </Badge>
        )}

        {scoringCriteria.trim() && (
          <Badge tone="positive" dot={false} capitalize={false}>
            <Brain size={10} /> Semantic
          </Badge>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <IconButton type="button" title={expanded ? 'Collapse' : 'Expand'} onClick={() => setExpanded(v => !v)}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </IconButton>
          <IconButton tone="danger" type="button" title="Remove item" onClick={onRemove}>
            <X size={16} />
          </IconButton>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-4 flex flex-col gap-4">
          {/* Text */}
          <Field
            label={item.itemType === 'question' ? 'Question text' : 'Information to convey'}
            error={item.itemType === 'question' && !item.text?.trim()
              ? 'Question text is required — the bot will skip this item.'
              : undefined}
          >
            <Textarea rows={2} value={item.text}
              onChange={e => update({ text: e.target.value })}
              placeholder={item.itemType === 'question'
                ? 'e.g. What is your current CTC?'
                : 'e.g. This call is regarding your pending EMI of ₹5,000.'}
              className="resize-y" />
          </Field>

          {/* Question-only fields */}
          {item.itemType === 'question' && (
            <>
              {/* Expected answer — Condition | Semantic tabs */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-foreground">Expected answer</span>
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
                    <ConditionSelect value={expectedAnswer.condition} onChange={v => updateAns({ condition: v })} className="w-40" aria-label="Expected answer condition" />
                    {expectedAnswer.condition !== 'is any value' && (
                      <div className="flex-1 min-w-[160px]">
                        <Input type="text" value={expectedAnswer.value}
                          onChange={e => updateAns({ value: e.target.value })}
                          placeholder="Expected value…"
                          aria-label="Expected value"
                          className={DENSE} />
                      </div>
                    )}
                  </div>
                )}

                {answerTab === 'semantic' && (
                  <div className="flex flex-col gap-1.5">
                    <Textarea
                      rows={3}
                      value={scoringCriteria}
                      onChange={e => update({ scoringCriteria: e.target.value })}
                      placeholder={"Describe what a good answer looks like in plain English.\n\ne.g. Should have an engineering degree and Node.js experience. Give 0 if no experience, proportional marks for 1–4 years, full marks for 5+ years."}
                      aria-label="Semantic scoring criteria"
                      className="resize-y"
                    />
                    <p className="text-xs text-muted-foreground">
                      AI uses this to score the answer in reports. Describe criteria and scoring thresholds in plain English. This tab must stay selected for it to govern scoring — switching back to Condition uses that rule instead, even if this is filled in.
                    </p>
                  </div>
                )}
              </div>

              {/* On Answer action */}
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium text-foreground">Action after answer</span>
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
                  <div className="flex flex-col gap-2 mt-1 p-3 rounded-xl border border-border bg-paper-200/60 dark:bg-white/[0.03]">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground font-medium">
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
                        <ConditionSelect value={onAnswer.skipCondition.condition} onChange={v => updateSkip({ condition: v })} className="w-40" aria-label="Skip condition" />
                        {onAnswer.skipCondition.condition !== 'is any value' && (
                          <div className="flex-1 min-w-[140px]">
                            <Input type="text" value={onAnswer.skipCondition.value}
                              onChange={e => updateSkip({ value: e.target.value })}
                              placeholder="condition value…"
                              aria-label="Skip condition value"
                              className={DENSE} />
                          </div>
                        )}
                      </div>
                    )}

                    {skipConditionTab === 'semantic' && (
                      <div className="flex flex-col gap-1.5">
                        <Textarea
                          rows={2}
                          value={skipSemanticCondition}
                          onChange={e => updateOnAns({ skipSemanticCondition: e.target.value })}
                          placeholder={onAnswer.action === 'end_call'
                            ? 'e.g. If user says they are not interested or busy'
                            : 'e.g. If user has less than 2 years of experience'}
                          aria-label="Semantic skip condition"
                          className="resize-y"
                        />
                        <p className="text-xs text-muted-foreground">
                          AI evaluates this live during the call against the user's answer.
                        </p>
                      </div>
                    )}

                    {onAnswer.action === 'skip_question' && (
                      <>
                        <p className="text-xs text-muted-foreground font-medium mt-1">Then JUMP directly to:</p>
                        <GenericSelect
                          aria-label="Jump to question"
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
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Database size={12} className="text-brand-500" /> Fields to Extract
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">
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
                      <div key={sf.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-paper-200/60 dark:bg-white/[0.03]">
                        <div className="flex-1 min-w-0">
                          <Input
                            type="text"
                            value={sf.field}
                            onChange={e => updateSubField(sf.id, { field: e.target.value })}
                            placeholder="Field name (e.g. notice_period)"
                            aria-label="Field name"
                            className={DENSE}
                          />
                        </div>
                        <Select
                          value={sf.type}
                          onChange={e => updateSubField(sf.id, { type: e.target.value })}
                          aria-label="Field type"
                          className={`${DENSE} !w-auto`}
                        >
                          <option value="string">Text</option>
                          <option value="number">Number</option>
                          <option value="boolean">Yes/No</option>
                          <option value="array">List</option>
                        </Select>
                        <div className="w-24 shrink-0">
                          <Input
                            type="text"
                            value={sf.unit || ''}
                            onChange={e => updateSubField(sf.id, { unit: e.target.value })}
                            placeholder="Unit (e.g. years)"
                            aria-label="Unit"
                            className={DENSE}
                          />
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <div className="w-14">
                            <Input
                              type="number" min={0} max={100}
                              value={sf.weight ?? 0}
                              onChange={e => updateSubField(sf.id, {
                                weight: Math.min(100, Math.max(0, Number(e.target.value))),
                                isWeightManuallySet: true
                              })}
                              aria-label="Field weight"
                              className={`${DENSE} !px-1 text-center tabular-nums`}
                            />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">%</span>
                        </div>
                        <IconButton tone="danger" size="sm" type="button" title="Remove field" onClick={() => removeSubField(sf.id)}>
                          <X size={13} />
                        </IconButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Mandatory + Weight */}
              <div className="flex items-center justify-between gap-6 pt-2 border-t border-paper-400 dark:border-ink-400/50 flex-wrap">
                <div className="flex items-center justify-between flex-1 min-w-[200px]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-foreground">Mandatory</span>
                    <span className="text-xs text-muted-foreground">Bot retries if no valid answer received</span>
                  </div>
                  <ToggleSwitch
                    checked={!!item.is_mandatory}
                    onChange={(checked) => update({ is_mandatory: checked })}
                    title="Mandatory"
                  />
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-muted-foreground text-right">Call Score Weight</span>
                    <span className="text-xs font-medium text-muted-foreground">
                      {hasSubFields ? 'Sub-fields split this equally' : 'Contribution to success score'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-16">
                      <Input type="number" min={0} max={100} value={item.weight ?? 0}
                        onChange={e => update({
                          weight: Math.min(100, Math.max(0, Number(e.target.value))),
                          isWeightManuallySet: true,
                          fieldsToExtract: (item.fieldsToExtract || []).map(sf => ({ ...sf, isWeightManuallySet: false }))
                        })}
                        aria-label="Call score weight"
                        className="!h-8 !px-2 text-center tabular-nums" />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">%</span>
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
