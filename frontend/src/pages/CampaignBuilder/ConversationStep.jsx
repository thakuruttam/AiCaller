import React, { useState } from 'react';
import { Button, Card, Checkbox, Field, Input, Textarea } from '../../components/ui';
import IssueText from './IssueText';
import SoundSettings from './SoundSettings';
import TryItPanel from './TryItPanel';
import {
  KNOWLEDGE_MAX_CHARS, MAX_RULES, OBJECTIVE_PRESETS, SUGGESTED_NEVER_RULES,
  emptyConversation, wordCount,
} from './campaignModel';

function CardTitle({ icon, title, hint, aside }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true" className="material-symbols-outlined [--icon-size:18px] text-brand-500 mt-px">{icon}</span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
        </div>
      </div>
      {aside}
    </div>
  );
}

/** A list of short rules: chips you can remove, a box to add one, optional suggestions. */
function RuleList({ label, tone, rules, onChange, suggestions = [], placeholder }) {
  const [draft, setDraft] = useState('');
  const add = (text) => {
    const t = String(text).trim();
    if (!t || rules.includes(t) || rules.length >= MAX_RULES) return;
    onChange([...rules, t]);
    setDraft('');
  };
  const unused = suggestions.filter(s => !rules.includes(s));
  const chip = tone === 'never'
    ? 'bg-negative/10 text-negative-dim dark:text-negative'
    : 'bg-positive/10 text-positive-dim dark:text-positive';

  return (
    <div>
      <p className="text-[13px] font-medium text-foreground mb-1.5">{label}</p>
      {rules.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mb-2" aria-label={`${label} rules`}>
          {rules.map(r => (
            <li key={r} className={`inline-flex items-center gap-1 rounded-full pl-2.5 pr-1 py-0.5 text-xs font-medium ${chip}`}>
              {r}
              <button
                type="button"
                onClick={() => onChange(rules.filter(x => x !== r))}
                aria-label={`Remove "${r}"`}
                className="flex size-5 items-center justify-center rounded-full cursor-pointer hover:bg-black/10 dark:hover:bg-white/10"
              >
                <span className="material-symbols-outlined [--icon-size:14px]">close</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          aria-label={`Add a ${label.toLowerCase()} rule`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(draft); } }}
          placeholder={placeholder}
        />
        <Button variant="subtle" size="sm" icon="add" onClick={() => add(draft)} disabled={!draft.trim()}>Add</Button>
      </div>
      {unused.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-xs text-muted-foreground">Suggestions:</span>
          {unused.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-paper-800 dark:border-white/25 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground hover:border-brand-500 cursor-pointer"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** An end-of-call condition that is always on — shown so nobody wonders. */
function FixedRule({ children }) {
  return (
    <li className="flex items-start gap-2.5 text-[13px] text-foreground">
      <span aria-hidden="true" className="material-symbols-outlined [--icon-size:16px] text-muted-foreground mt-px">lock</span>
      <span>{children} <span className="text-xs text-muted-foreground">· always</span></span>
    </li>
  );
}

/**
 * Step 1 for a conversation campaign: a brief for the agent rather than a
 * script — what success is, what it knows, what it must never say, and when
 * it hangs up — with a test chat beside it.
 */
export default function ConversationStep({ payload, update, issues }) {
  const goals = payload.goals || {};
  const conv = payload.conversation || emptyConversation();
  const knowledge = conv.knowledge || '';
  const setGoal = (key, value) => update({ goals: { ...goals, [key]: value } });
  const setConv = (patch) => update({ conversation: { ...conv, ...patch } });
  const setRules = (key, list) => setConv({ rules: { ...conv.rules, [key]: list } });
  const setEndWhen = (key, value) => setConv({ endWhen: { ...conv.endWhen, [key]: value } });

  // Picking a preset fills the objective, unless the operator has written
  // their own words there.
  const pickPreset = (preset) => {
    const presetExamples = OBJECTIVE_PRESETS.map(p => p.example).filter(Boolean);
    const current = (goals.goal || '').trim();
    const ownWords = current && !presetExamples.includes(current);
    const example = OBJECTIVE_PRESETS.find(p => p.value === preset)?.example || '';
    update({
      conversation: { ...conv, objectivePreset: preset },
      ...(ownWords ? {} : { goals: { ...goals, goal: example } }),
    });
  };

  const words = wordCount(knowledge);
  const share = knowledge.length / KNOWLEDGE_MAX_CHARS;
  const meter = share > 1 ? 'bg-negative' : share > 0.8 ? 'bg-caution' : 'bg-positive';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start animate-fade-in">
      <div className="flex flex-col gap-5 min-w-0">
        <Card>
          <CardTitle icon="flag" title="Objective" hint="What a successful call achieves. Everything the agent says moves toward this." />
          <div role="radiogroup" aria-label="Kind of objective" className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {OBJECTIVE_PRESETS.map(p => {
              const selected = conv.objectivePreset === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => pickPreset(p.value)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium cursor-pointer transition-colors
                    outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30
                    ${selected ? 'border-brand-500 bg-brand-500/10 text-foreground' : 'border-border text-muted-foreground hover:text-foreground hover:border-paper-800 dark:hover:border-white/20'}`}
                >
                  <span aria-hidden="true" className="material-symbols-outlined [--icon-size:17px]">{p.icon}</span>
                  {p.label}
                </button>
              );
            })}
          </div>
          <Field label="In your words">
            <Input
              value={goals.goal || ''}
              onChange={(e) => setGoal('goal', e.target.value)}
              placeholder="e.g. Book a 15-minute demo with the person who decides on this."
            />
          </Field>
          {issues.fields.goal && <IssueText issue={issues.fields.goal} />}
        </Card>

        <Card>
          <CardTitle icon="call" title="Opening and closing" hint="The only lines said word for word. [Name] becomes each person's name." />
          <div className="flex flex-col gap-4">
            <Field label="Opening line">
              <Textarea rows={2} value={goals.callIntro || ''} onChange={(e) => setGoal('callIntro', e.target.value)} placeholder="Hi [Name], I'm calling from…" />
            </Field>
            {issues.fields.callIntro && <IssueText issue={issues.fields.callIntro} />}
            <Field label="Closing line" hint={issues.fields.callSignOff ? undefined : 'Played whenever the call ends — the agent never makes up its own goodbye.'}>
              <Textarea rows={2} value={goals.callSignOff || ''} onChange={(e) => setGoal('callSignOff', e.target.value)} placeholder="Thanks so much for your time…" />
            </Field>
            {issues.fields.callSignOff && <IssueText issue={issues.fields.callSignOff} />}
          </div>
        </Card>

        <Card>
          <CardTitle
            icon="menu_book"
            title="What the agent knows"
            hint="Product, pricing, FAQs, answers to common objections. The agent states only what's here — anything else, it says the team will follow up."
            aside={(
              <span className={`shrink-0 text-xs tabular-nums ${share > 1 ? 'text-negative-dim dark:text-negative font-medium' : 'text-muted-foreground'}`}>
                {words.toLocaleString('en-IN')} words
              </span>
            )}
          />
          <Textarea
            aria-label="What the agent knows"
            rows={10}
            value={knowledge}
            onChange={(e) => setConv({ knowledge: e.target.value })}
            placeholder={'Paste anything the agent should be able to answer from, e.g.\n\nAcme CRM — ₹999 per user per month, billed yearly. Free 14-day trial, no card needed.\nSetup takes one day; we import your spreadsheets for you.\nIf they say it\'s too expensive: most teams save 5+ hours a week on follow-ups…'}
          />
          <div className="mt-2 h-1 rounded-full bg-paper-400 dark:bg-white/10 overflow-hidden" aria-hidden="true">
            <div className={`h-full ${meter} transition-[width]`} style={{ width: `${Math.min(100, share * 100)}%` }} />
          </div>
          {issues.fields.knowledge
            ? <IssueText issue={issues.fields.knowledge} />
            : <p className="mt-1.5 text-xs text-muted-foreground">Up to about 6,000 words. Shorter and clearer works better on a call.</p>}
        </Card>

        <Card>
          <CardTitle icon="block" title="Rules" hint="Hard limits on what the agent says, whatever the caller asks." />
          <div className="flex flex-col gap-5">
            <RuleList
              label="Never"
              tone="never"
              rules={conv.rules?.never || []}
              onChange={(list) => setRules('never', list)}
              suggestions={SUGGESTED_NEVER_RULES}
              placeholder="e.g. Offer discounts or special pricing"
            />
            <RuleList
              label="Always"
              tone="always"
              rules={conv.rules?.always || []}
              onChange={(list) => setRules('always', list)}
              placeholder="e.g. Mention the free 14-day trial"
            />
          </div>
        </Card>

        <Card>
          <CardTitle icon="call_end" title="Ending the call" hint="The closing line plays whichever way it ends. The longest call is set under How it sounds." />
          <ul className="flex flex-col gap-3">
            <li>
              <label className="flex items-start gap-2.5 text-[13px] text-foreground cursor-pointer">
                <Checkbox className="mt-0.5" checked={conv.endWhen?.endOnObjective !== false} onChange={(e) => setEndWhen('endOnObjective', e.target.checked)} />
                <span>
                  Hang up once the objective is reached
                  <span className="block text-xs text-muted-foreground">Off: the agent stays on to answer any last questions.</span>
                </span>
              </label>
            </li>
            <li>
              <label className="flex items-start gap-2.5 text-[13px] text-foreground cursor-pointer">
                <Checkbox className="mt-0.5" checked={!!conv.endWhen?.acceptFirstNo} onChange={(e) => setEndWhen('acceptFirstNo', e.target.checked)} />
                <span>
                  Accept the first "not interested"
                  <span className="block text-xs text-muted-foreground">Off: the agent answers their concern once, then accepts a second no. It never pushes further.</span>
                </span>
              </label>
            </li>
            <FixedRule>They ask to be called another time</FixedRule>
            <FixedRule>They ask not to be called again</FixedRule>
            <FixedRule>It's the wrong person</FixedRule>
          </ul>
          <Field label="Also end the call if… (optional)" className="mt-5">
            <Input
              value={payload.endCallIf || ''}
              onChange={(e) => update({ endCallIf: e.target.value })}
              placeholder="e.g. They already use a tool they are happy with"
            />
          </Field>
        </Card>
      </div>

      {/* Sticky so the test chat stays beside the brief while it's edited;
          top-28 clears the sticky step header above. */}
      <div className="flex flex-col gap-5 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        <TryItPanel payload={payload} />
        <SoundSettings
          payload={payload}
          update={update}
          languages={['English']}
          languageHint="Conversation calls are English-only for now."
          languageIssue={issues.fields.language}
        />
      </div>
    </div>
  );
}
