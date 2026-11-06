import React, { useState } from 'react';
import { Button, Checkbox, IconButton, Input, Select, Textarea } from '../../components/ui';
import { uid } from './campaignModel';
import {
  ANSWER_TYPES, MATCH_CONDITIONS, answerChoices, answerTypeOf, describeLogic, readLogic,
  setAnswerType, updateLogic,
} from './questionLogic';
import IssueText from './IssueText';
import VariableText from './VariableText';

// Rule rows are denser than a form, so their controls use Button sm's 32px.
const DENSE = '!h-8';

const FACT_TONE = {
  negative: 'text-negative-dim dark:text-negative',
  brand: 'text-brand-600 dark:text-brand-300',
  caution: 'text-caution-dim dark:text-caution',
  neutral: 'text-muted-foreground',
};

/** A filled star when on — the answer that scores. */
function GoodToggle({ on, label, onClick }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={on ? 'Good answer — click to clear' : 'Mark as the good answer'}
      onClick={onClick}
      className={`flex size-8 items-center justify-center rounded-full cursor-pointer outline-none transition-colors
        focus-visible:ring-[3px] focus-visible:ring-brand-500/30
        ${on ? 'text-caution-dim dark:text-caution bg-caution/10' : 'text-muted-foreground/70 hover:text-foreground hover:bg-paper-300/70 dark:hover:bg-white/[0.06]'}`}
    >
      <span className="material-symbols-outlined [--icon-size:19px]" style={on ? { fontVariationSettings: "'FILL' 1" } : undefined}>star</span>
    </button>
  );
}

/** Carry on / end the call / jump to a later line — one select for "then". */
function ThenSelect({ route, items, index, label, allowContinue = true, onChange }) {
  const value = !route ? 'continue' : route.action === 'end_call' ? 'end_call' : `jump:${route.skipToId || ''}`;
  const later = items.slice(index + 1);
  const pick = (v) => {
    if (v === 'continue') onChange(null);
    else if (v === 'end_call') onChange({ action: 'end_call', skipToId: '' });
    else onChange({ action: 'skip_question', skipToId: v.slice(5) });
  };
  return (
    <Select aria-label={label} value={value} onChange={(e) => pick(e.target.value)} className={`${DENSE} text-xs`}>
      {allowContinue && <option value="continue">Carry on</option>}
      <option value="end_call">End the call</option>
      {value === 'jump:' && <option value="jump:" disabled>Jump to… (pick a line)</option>}
      {later.map((target, k) => (
        <option key={target.id} value={`jump:${target.id}`}>
          Jump to {index + k + 2} · {target.text?.trim().slice(0, 48) || 'Untitled'}
        </option>
      ))}
    </Select>
  );
}

/** Yes/no and number questions: each possible answer, what it leads to, and whether it scores. */
function AnswerTable({ logic, items, index, n, patch }) {
  const choices = answerChoices(logic);
  return (
    <div className="flex flex-col gap-3">
      {logic.type === 'number' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Compare answers with</span>
          <span className="w-20">
            <Input
              aria-label={`Question ${n} — number to compare with`}
              inputMode="decimal"
              value={logic.threshold}
              onChange={(e) => patch({ threshold: e.target.value })}
              placeholder="e.g. 2"
              className={`${DENSE} tabular-nums`}
            />
          </span>
          <span className="w-32">
            <Input
              aria-label={`Question ${n} — unit`}
              value={logic.unit}
              onChange={(e) => patch({ unit: e.target.value })}
              placeholder="unit, e.g. years"
              className={DENSE}
            />
          </span>
        </div>
      )}
      {/* A three-column table from sm up. On a phone each answer gets two
          lines — the answer and its star, then what it leads to — so the
          select keeps a readable width. Cells are placed by column with dense
          flow because the star comes before the select in the DOM. */}
      <div
        role="table"
        aria-label={`Question ${n} answers`}
        className="flex flex-col gap-2.5 sm:grid sm:grid-flow-row-dense sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] sm:items-center sm:gap-x-3 sm:gap-y-1.5"
      >
        <div role="row" className="flex justify-between sm:contents">
          <span role="columnheader" className="sm:col-start-1 text-xs text-muted-foreground">{logic.type === 'number' ? 'If the answer is' : 'If they say'}</span>
          <span role="columnheader" className="hidden sm:block sm:col-start-2 text-xs text-muted-foreground">Then</span>
          <span role="columnheader" className="sm:col-start-3 text-xs text-muted-foreground text-right">Good answer</span>
        </div>
        {choices.map(choice => (
          <div role="row" key={choice.key} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:contents">
            <span role="cell" className="sm:col-start-1 inline-flex items-center gap-1.5 h-8 w-fit max-w-full rounded-full bg-card dark:bg-white/[0.05] border border-border px-3 text-[13px] font-medium text-foreground">
              <span className="material-symbols-outlined [--icon-size:15px] text-muted-foreground">{choice.icon}</span>
              <span className="truncate">{choice.label}</span>
            </span>
            <span role="cell" className="ml-auto sm:ml-0 sm:col-start-3 flex justify-end">
              <GoodToggle
                on={logic.good === choice.key}
                label={`${choice.label} is a good answer to question ${n}`}
                onClick={() => patch({ good: logic.good === choice.key ? null : choice.key })}
              />
            </span>
            <span role="cell" className="basis-full sm:col-start-2 min-w-0">
              <ThenSelect
                label={`Question ${n} — if ${choice.label.toLowerCase()}, then`}
                route={logic.route?.when === choice.key ? logic.route : null}
                items={items}
                index={index}
                onChange={(r) => {
                  // The engine follows one rule per question, so giving this
                  // answer a rule takes it off the other one.
                  if (r) patch({ route: { ...r, when: choice.key } });
                  else if (logic.route?.when === choice.key) patch({ route: null });
                }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** A label + control row in the free-form editor. */
function Row({ icon, label, children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[132px_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5">
      <span className="flex items-center gap-1.5 h-8 text-xs text-muted-foreground">
        <span className="material-symbols-outlined [--icon-size:16px]">{icon}</span>
        {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function MatchPicker({ match, label, onChange }) {
  const yesNo = match.condition === 'is_true' || match.condition === 'is_false';
  return (
    <div className="flex flex-wrap gap-2 flex-1 min-w-0">
      <Select
        aria-label={`${label} — how to compare`}
        value={match.condition}
        onChange={(e) => onChange({ ...match, condition: e.target.value })}
        className={`${DENSE} !w-auto text-xs`}
      >
        {MATCH_CONDITIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </Select>
      {!yesNo && (
        <div className="flex-1 min-w-[120px]">
          <Input aria-label={`${label} — value`} value={match.value} onChange={(e) => onChange({ ...match, value: e.target.value })} placeholder="e.g. yes" className={DENSE} />
        </div>
      )}
    </div>
  );
}

/** Free-form questions: a good answer described in words, and an optional rule. */
function OpenAnswer({ logic, items, index, n, patch }) {
  const route = logic.route;
  return (
    <div className="flex flex-col gap-2.5">
      <Row icon="star" label="Good answer">
        {logic.match ? (
          <div className="flex items-center gap-1">
            <MatchPicker match={logic.match} label={`Question ${n} good answer`} onChange={(match) => patch({ match })} />
            <IconButton size="sm" icon="close" title="Describe it in words instead" onClick={() => patch({ match: null, criteria: '' })} />
          </div>
        ) : (
          <Textarea
            aria-label={`Question ${n} — what a good answer looks like`}
            rows={1}
            value={logic.criteria}
            onChange={(e) => patch({ criteria: e.target.value })}
            placeholder="Any answer is fine — or describe a good one, e.g. “30 days or less”"
            className="field-sizing-content min-h-8 !py-1.5 resize-none"
          />
        )}
      </Row>
      <Row icon="call_split" label="Rule">
        {route ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">If</span>
            {route.condition ? (
              <MatchPicker
                match={route.condition}
                label={`Question ${n} rule`}
                onChange={(condition) => patch({ route: { ...route, condition } })}
              />
            ) : (
              <div className="flex-1 min-w-[180px]">
                <Input
                  aria-label={`Question ${n} — when the rule applies`}
                  value={route.text}
                  onChange={(e) => patch({ route: { ...route, text: e.target.value } })}
                  placeholder="they say they're not interested"
                  className={DENSE}
                />
              </div>
            )}
            <span className="text-xs text-muted-foreground">then</span>
            <span className="min-w-[150px] flex-1 sm:flex-none">
              <ThenSelect
                label={`Question ${n} — then`}
                route={route}
                items={items}
                index={index}
                allowContinue={false}
                onChange={(r) => patch({ route: { ...route, ...r } })}
              />
            </span>
            <IconButton size="sm" icon="close" title="Remove this rule" onClick={() => patch({ route: null })} />
          </div>
        ) : (
          <Button
            variant="link"
            size="sm"
            className="h-8"
            onClick={() => patch({ route: { when: 'custom', action: 'end_call', skipToId: '', text: '', condition: null } })}
          >
            <span className="sm:hidden">Add a rule</span>
            <span className="hidden sm:inline">End the call or jump ahead depending on the answer</span>
          </Button>
        )}
      </Row>
    </div>
  );
}

/** Values pulled out of the answer into their own report columns. */
function Details({ item, update }) {
  const subs = item.fieldsToExtract || [];
  const setSubs = (next) => update({ fieldsToExtract: next });
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Each becomes its own column in reports — e.g. “about two and a half years” saved as years_experience = 2.5.
      </p>
      {subs.map((sf) => (
        <div key={sf.id} className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[140px]">
            <Input
              aria-label="Detail name"
              value={sf.field}
              onChange={(e) => setSubs(subs.map(x => x.id === sf.id ? { ...x, field: e.target.value } : x))}
              placeholder="Name, e.g. notice_days"
              className={DENSE}
            />
          </div>
          <Select
            aria-label="Detail type"
            value={sf.type}
            onChange={(e) => setSubs(subs.map(x => x.id === sf.id ? { ...x, type: e.target.value } : x))}
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
              onChange={(e) => setSubs(subs.map(x => x.id === sf.id ? { ...x, unit: e.target.value } : x))}
              placeholder="Unit"
              className={DENSE}
            />
          </div>
          <IconButton size="sm" tone="danger" icon="close" title={`Remove ${sf.field || 'detail'}`} onClick={() => setSubs(subs.filter(x => x.id !== sf.id))} />
        </div>
      ))}
      <div>
        <Button
          variant="subtle"
          size="sm"
          icon="add"
          onClick={() => setSubs([...subs, { id: uid(), field: '', type: 'string', unit: '', weight: 0, isWeightManuallySet: false }])}
        >
          Add a detail
        </Button>
      </div>
    </div>
  );
}

/**
 * One line of the script. Folded, it reads as the question plus a line of
 * icon-led facts — where it can end or redirect the call, what scores — so the
 * logic of the whole call is visible without opening anything. Clicking a
 * line opens it: its possible answers, what each one leads to, and which one
 * is good.
 */
export default function ScriptItem({
  item, index, items, issue, active, autoFocus, incoming = [],
  onActivate, onChange, onRemove, onMove, onEnter,
}) {
  const isQuestion = item.itemType !== 'information';
  const n = index + 1;
  const [detailsOpen, setDetailsOpen] = useState(!!item.fieldsToExtract?.length);
  const update = (patch) => onChange({ ...item, ...patch });
  const logic = isQuestion ? readLogic(item) : null;
  const patch = (p) => onChange(updateLogic(item, p));
  const type = isQuestion ? answerTypeOf(item) : null;
  const typeInfo = ANSWER_TYPES.find(t => t.value === type);
  const facts = isQuestion ? describeLogic(item, items) : [];
  if (incoming.length) facts.push({ icon: 'subdirectory_arrow_right', tone: 'brand', text: `Jump from ${incoming.join(', ')}` });

  const activate = () => { if (!active) onActivate(); };

  return (
    <li data-script-line className="relative pl-11" onFocusCapture={activate} onMouseDown={activate}>
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
        className={`rounded-xl border bg-card dark:bg-white/[0.02] transition-[border-color,box-shadow]
          ${issue ? (issue.gap ? 'border-caution/30' : 'border-negative/25') : active ? 'border-brand-500/40 shadow-sm' : 'border-border hover:border-paper-700 dark:hover:border-white/20'}
          ${active ? '' : 'cursor-pointer'}`}
      >
        <div className="flex flex-wrap sm:flex-nowrap items-start gap-x-2 gap-y-1 p-1.5">
          <div className="basis-full sm:basis-0 sm:flex-1 min-w-0">
            {isQuestion ? (
              <VariableText
                as="input-raw"
                aria-label={`Question ${n}`}
                value={item.text}
                autoFocus={autoFocus}
                onChange={(v) => update({ text: v })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
                placeholder="Type a question, then press Enter for the next one"
                className="w-full h-9 bg-transparent px-2.5 text-sm text-foreground placeholder:text-muted-foreground/80
                           rounded-control outline-none focus:bg-paper-200/60 dark:focus:bg-white/[0.04] transition-colors"
              />
            ) : (
              <VariableText
                as="textarea-raw"
                aria-label={`Statement ${n}`}
                rows={active ? 2 : 1}
                value={item.text}
                autoFocus={autoFocus}
                onChange={(v) => update({ text: v })}
                placeholder="Something the agent says without asking — e.g. “This call is about your order from last week.”"
                className="w-full resize-none field-sizing-content bg-transparent px-2.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/80
                           rounded-control outline-none focus:bg-paper-200/60 dark:focus:bg-white/[0.04] transition-colors"
              />
            )}
          </div>
          {isQuestion && (active ? (
            <span className="w-40 shrink-0 ml-auto sm:ml-0">
              <Select
                aria-label={`Question ${n} — kind of answer`}
                value={type}
                onChange={(e) => onChange(setAnswerType(item, e.target.value))}
                className="text-xs"
              >
                {ANSWER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </span>
          ) : (
            <span className="hidden sm:inline-flex shrink-0 items-center gap-1 h-9 pr-2 text-xs text-muted-foreground" title="Kind of answer">
              <span className="material-symbols-outlined [--icon-size:15px]">{typeInfo.icon}</span>
              {typeInfo.label}
            </span>
          ))}
        </div>

        {!active && facts.length > 0 && (
          <ul aria-label={`What line ${n} does`} className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-2.5 -mt-0.5">
            {facts.map(f => (
              <li key={f.text} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <span className={`material-symbols-outlined [--icon-size:14px] ${FACT_TONE[f.tone]}`}>{f.icon}</span>
                <span className={f.tone === 'negative' || f.tone === 'brand' ? 'text-foreground' : ''}>{f.text}</span>
              </li>
            ))}
          </ul>
        )}

        {active && isQuestion && (
          <div className="mx-1.5 mb-1.5 rounded-lg bg-paper-200/60 dark:bg-white/[0.03] p-3 animate-fade-in">
            {logic.type === 'open'
              ? <OpenAnswer logic={logic} items={items} index={index} n={n} patch={patch} />
              : <AnswerTable logic={logic} items={items} index={index} n={n} patch={patch} />}
          </div>
        )}

        {active && isQuestion && detailsOpen && (
          <div className="px-3 pt-1 pb-3">
            <Details item={item} update={update} />
          </div>
        )}

        {active && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-3 py-1.5">
            {isQuestion && (
              <label className="inline-flex items-center gap-2 text-xs text-foreground cursor-pointer">
                <Checkbox checked={!!item.is_mandatory} onChange={(e) => update({ is_mandatory: e.target.checked })} />
                Keep asking until they answer
              </label>
            )}
            <span className="flex items-center ml-auto">
              {isQuestion && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon="table_rows"
                  aria-expanded={detailsOpen}
                  onClick={() => setDetailsOpen(o => !o)}
                  className="aria-expanded:text-foreground"
                >
                  Save details
                </Button>
              )}
              <IconButton size="sm" icon="arrow_upward" title={`Move line ${n} up`} disabled={index === 0} onClick={() => onMove(-1)} />
              <IconButton size="sm" icon="arrow_downward" title={`Move line ${n} down`} disabled={index === items.length - 1} onClick={() => onMove(1)} />
              <IconButton size="sm" tone="danger" icon="delete" title={`Remove line ${n}`} onClick={onRemove} />
            </span>
          </div>
        )}
      </div>
      {issue && <IssueText issue={issue} />}
    </li>
  );
}
