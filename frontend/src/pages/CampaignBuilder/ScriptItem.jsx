import React, { useState } from 'react';
import { Badge, Button, IconButton, Input, Select, Tabs, Textarea } from '../../components/ui';
import ToggleSwitch from '../../components/ToggleSwitch';
import { CONDITIONS, itemWeight, scoringMode, setScoringMode, uid } from './campaignModel';
import IssueText from './IssueText';

// Rule rows are denser than a form, so their controls use Button sm's 32px.
const DENSE = '!h-8';

function ConditionPicker({ condition, value, onChange, label }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Select
        aria-label={`${label} — how to compare`}
        value={condition}
        onChange={(e) => onChange({ condition: e.target.value, value })}
        className={`${DENSE} !w-auto text-xs`}
      >
        {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
      </Select>
      <div className="flex-1 min-w-[160px]">
        <Input
          aria-label={`${label} — value`}
          value={value}
          onChange={(e) => onChange({ condition, value: e.target.value })}
          placeholder="e.g. yes"
          className={DENSE}
        />
      </div>
    </div>
  );
}

function OptionGroup({ title, hint, children }) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-[13px] font-medium text-foreground">{title}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** What a question does beyond asking, in a few words — shown while folded. */
function summarize(item, items) {
  const chips = [];
  if (item.is_mandatory) chips.push({ text: 'Must answer', tone: 'brand' });
  const mode = scoringMode(item);
  if (mode === 'ai') chips.push({ text: 'AI scores the answer', tone: 'neutral' });
  if (mode === 'match') chips.push({ text: `Answer ${item.expectedAnswer.condition} “${item.expectedAnswer.value}”`, tone: 'neutral' });
  const action = item.onAnswer?.action;
  if (action === 'end_call') chips.push({ text: 'Can end the call', tone: 'caution' });
  if (action === 'skip_question') {
    const to = items.findIndex(i => i.id === item.onAnswer.skipToId);
    chips.push({ text: to >= 0 ? `Can skip to ${to + 1}` : 'Skips ahead', tone: 'neutral' });
  }
  if (item.fieldsToExtract?.length) chips.push({ text: `Saves ${item.fieldsToExtract.length} value${item.fieldsToExtract.length === 1 ? '' : 's'}`, tone: 'neutral' });
  // Only a weight that differs from an even split is worth pointing out.
  const questions = items.filter(i => i.itemType !== 'information').length || 1;
  if (Math.abs(itemWeight(item) - 100 / questions) >= 1) chips.push({ text: `Weight ${itemWeight(item)}%`, tone: 'neutral' });
  return chips;
}

/**
 * One line of the script. Folded, it's just the words the agent says — which
 * is all most campaigns need. "Options" opens scoring, branching, weight and
 * extraction, each written as a plain question rather than a field name.
 */
export default function ScriptItem({
  item, index, items, issue, autoFocus,
  onChange, onRemove, onMove, onEnter,
}) {
  const [open, setOpen] = useState(false);
  const isQuestion = item.itemType !== 'information';
  const n = index + 1;
  const update = (patch) => onChange({ ...item, ...patch });
  const updateOnAnswer = (patch) => update({ onAnswer: { ...item.onAnswer, ...patch } });
  const mode = scoringMode(item);
  const action = item.onAnswer?.action || 'continue';
  const subs = item.fieldsToExtract || [];
  const chips = isQuestion ? summarize(item, items) : [];
  const panelId = `options-${item.id}`;

  return (
    <li className="relative pl-11">
      {/* Position on the conversation's spine. */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1.5 flex size-7 items-center justify-center rounded-full text-xs font-semibold
          ${isQuestion
            ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300'
            : 'bg-paper-400 dark:bg-white/10 text-muted-foreground'}`}
      >
        {isQuestion ? n : <span className="material-symbols-outlined [--icon-size:15px]">campaign</span>}
      </span>

      <div
        className={`rounded-xl border bg-card dark:bg-white/[0.02] transition-colors
          ${issue ? (issue.gap ? 'border-caution/30' : 'border-negative/25') : open ? 'border-brand-500/25' : 'border-border'}`}
      >
        <div className="flex flex-wrap sm:flex-nowrap items-start gap-1.5 p-1.5">
          <div className="basis-full sm:basis-0 sm:flex-1 min-w-0">
            {isQuestion ? (
              <input
                aria-label={`Question ${n}`}
                value={item.text}
                autoFocus={autoFocus}
                onChange={(e) => update({ text: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
                placeholder="Type a question, then press Enter for the next one"
                className="w-full h-9 bg-transparent px-2.5 text-sm text-foreground placeholder:text-muted-foreground/80
                           rounded-control outline-none focus:bg-paper-200/60 dark:focus:bg-white/[0.04] transition-colors"
              />
            ) : (
              <textarea
                aria-label={`Statement ${n}`}
                rows={2}
                value={item.text}
                autoFocus={autoFocus}
                onChange={(e) => update({ text: e.target.value })}
                placeholder="Something the agent says without asking — e.g. “This call is about your order from last week.”"
                className="w-full resize-none bg-transparent px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/80
                           rounded-control outline-none focus:bg-paper-200/60 dark:focus:bg-white/[0.04] transition-colors"
              />
            )}
          </div>
          <div className="flex items-center shrink-0 ml-auto sm:pt-0.5">
            {isQuestion && (
              <Button
                variant="ghost"
                size="sm"
                icon="tune"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen(o => !o)}
                className="aria-expanded:bg-paper-300/70 dark:aria-expanded:bg-white/[0.06] aria-expanded:text-foreground"
              >
                <span className="hidden sm:inline">Options</span>
              </Button>
            )}
            <IconButton size="sm" icon="arrow_upward" title={`Move line ${n} up`} disabled={index === 0} onClick={() => onMove(-1)} />
            <IconButton size="sm" icon="arrow_downward" title={`Move line ${n} down`} disabled={index === items.length - 1} onClick={() => onMove(1)} />
            <IconButton size="sm" tone="danger" icon="delete" title={`Remove line ${n}`} onClick={onRemove} />
          </div>
        </div>

        {!open && chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-3 -mt-0.5">
            {chips.map((c) => (
              <Badge key={c.text} tone={c.tone} dot={false} capitalize={false}>{c.text}</Badge>
            ))}
          </div>
        )}

        {open && isQuestion && (
          <div id={panelId} className="border-t border-border px-4 py-4 flex flex-col gap-5 animate-fade-in">
            <OptionGroup title="How should the answer be scored?">
              <Tabs
                size="sm"
                value={mode}
                onChange={(m) => onChange(setScoringMode(item, m))}
                items={[
                  { value: 'any', label: 'Any answer counts' },
                  { value: 'ai', label: 'AI judges it', icon: 'psychology' },
                  { value: 'match', label: 'Must match', icon: 'rule' },
                ]}
              />
              {mode === 'ai' && (
                <Textarea
                  aria-label={`Question ${n} — what a good answer looks like`}
                  rows={2}
                  value={item.scoringCriteria || ''}
                  onChange={(e) => update({ scoringCriteria: e.target.value })}
                  placeholder="Describe a good answer, e.g. “Full marks for 3+ years, half for 1–2, none below that.”"
                />
              )}
              {mode === 'match' && (
                <ConditionPicker
                  label={`Question ${n} expected answer`}
                  condition={item.expectedAnswer?.condition}
                  value={item.expectedAnswer?.value ?? ''}
                  onChange={(expectedAnswer) => update({ expectedAnswer })}
                />
              )}
            </OptionGroup>

            <OptionGroup title="What happens after they answer?">
              <Select
                aria-label={`Question ${n} — after the answer`}
                value={action}
                onChange={(e) => updateOnAnswer({ action: e.target.value })}
                className={`${DENSE} text-xs`}
              >
                <option value="continue">Go on to the next line</option>
                <option value="end_call">End the call if…</option>
                <option value="skip_question" disabled={index >= items.length - 1}>Skip ahead if…</option>
              </Select>
              {action !== 'continue' && (
                <div className="flex flex-col gap-2 rounded-xl bg-paper-200/60 dark:bg-white/[0.03] p-3">
                  <Tabs
                    size="sm"
                    value={item.onAnswer.skipConditionActiveTab === 'condition' ? 'condition' : 'semantic'}
                    onChange={(t) => updateOnAnswer({ skipConditionActiveTab: t })}
                    items={[
                      { value: 'semantic', label: 'AI decides', icon: 'psychology' },
                      { value: 'condition', label: 'Answer matches', icon: 'rule' },
                    ]}
                  />
                  {item.onAnswer.skipConditionActiveTab === 'condition' ? (
                    <ConditionPicker
                      label={`Question ${n} branch`}
                      condition={item.onAnswer.skipCondition?.condition || 'contains'}
                      value={item.onAnswer.skipCondition?.value ?? ''}
                      onChange={(skipCondition) => updateOnAnswer({ skipCondition })}
                    />
                  ) : (
                    <Input
                      aria-label={`Question ${n} — when to ${action === 'end_call' ? 'end the call' : 'skip ahead'}`}
                      value={item.onAnswer.skipSemanticCondition || ''}
                      onChange={(e) => updateOnAnswer({ skipSemanticCondition: e.target.value })}
                      placeholder={action === 'end_call' ? 'e.g. They say they are not interested' : 'e.g. They have less than 2 years of experience'}
                      className={DENSE}
                    />
                  )}
                  {action === 'skip_question' && (
                    <Select
                      aria-label={`Question ${n} — skip to`}
                      value={item.onAnswer.skipToId || ''}
                      onChange={(e) => updateOnAnswer({ skipToId: e.target.value })}
                      className={`${DENSE} text-xs`}
                    >
                      <option value="">Skip to…</option>
                      {items.slice(index + 1).map((target, k) => (
                        <option key={target.id} value={target.id}>
                          {index + k + 2}. {target.text?.slice(0, 60) || 'Untitled'}
                        </option>
                      ))}
                    </Select>
                  )}
                </div>
              )}
            </OptionGroup>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <OptionGroup title="Must they answer?" hint="The agent asks again if the answer is unclear.">
                <span className="flex items-center gap-2.5">
                  <ToggleSwitch
                    checked={!!item.is_mandatory}
                    onChange={(v) => update({ is_mandatory: v })}
                    title={`Question ${n} must be answered`}
                  />
                  <span className="text-[13px] text-foreground">{item.is_mandatory ? 'Yes, keep asking' : 'No, move on'}</span>
                </span>
              </OptionGroup>

              <OptionGroup title="Share of the call score" hint={item.isWeightManuallySet ? 'Set by you.' : 'Shared evenly with the other questions.'}>
                <span className="flex items-center gap-2">
                  <span className="w-20">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      aria-label={`Question ${n} weight`}
                      value={item.weight ?? 0}
                      onChange={(e) => update({
                        weight: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                        isWeightManuallySet: true,
                        fieldsToExtract: subs.map(sf => ({ ...sf, isWeightManuallySet: false })),
                      })}
                      trailing={<span className="pr-1.5 text-xs text-muted-foreground">%</span>}
                      className={`${DENSE} tabular-nums`}
                    />
                  </span>
                  {item.isWeightManuallySet && (
                    <Button variant="link" size="sm" onClick={() => update({ isWeightManuallySet: false })}>Share evenly</Button>
                  )}
                </span>
              </OptionGroup>
            </div>

            <OptionGroup
              title="Pull out specific values"
              hint={subs.length ? 'Each value shows up as its own column in reports.' : 'Optional — e.g. turn “about two and a half years” into years_experience = 2.5.'}
            >
              {subs.map((sf) => (
                <div key={sf.id} className="flex flex-wrap items-center gap-2">
                  <div className="flex-1 min-w-[140px]">
                    <Input
                      aria-label="Value name"
                      value={sf.field}
                      onChange={(e) => update({ fieldsToExtract: subs.map(x => x.id === sf.id ? { ...x, field: e.target.value } : x) })}
                      placeholder="Name, e.g. notice_days"
                      className={DENSE}
                    />
                  </div>
                  <Select
                    aria-label="Value type"
                    value={sf.type}
                    onChange={(e) => update({ fieldsToExtract: subs.map(x => x.id === sf.id ? { ...x, type: e.target.value } : x) })}
                    className={`${DENSE} !w-auto text-xs`}
                  >
                    <option value="string">Text</option>
                    <option value="number">Number</option>
                    <option value="boolean">Yes / no</option>
                    <option value="array">List</option>
                  </Select>
                  <div className="w-24">
                    <Input
                      aria-label="Unit"
                      value={sf.unit || ''}
                      onChange={(e) => update({ fieldsToExtract: subs.map(x => x.id === sf.id ? { ...x, unit: e.target.value } : x) })}
                      placeholder="Unit"
                      className={DENSE}
                    />
                  </div>
                  <IconButton
                    size="sm"
                    tone="danger"
                    icon="close"
                    title={`Remove ${sf.field || 'value'}`}
                    onClick={() => update({ fieldsToExtract: subs.filter(x => x.id !== sf.id) })}
                  />
                </div>
              ))}
              <div>
                <Button
                  variant="subtle"
                  size="sm"
                  icon="add"
                  onClick={() => update({
                    fieldsToExtract: [...subs, { id: uid(), field: '', type: 'string', unit: '', weight: 0, isWeightManuallySet: false }],
                  })}
                >
                  Add a value
                </Button>
              </div>
            </OptionGroup>
          </div>
        )}
      </div>
      {issue && <IssueText issue={issue} />}
    </li>
  );
}

