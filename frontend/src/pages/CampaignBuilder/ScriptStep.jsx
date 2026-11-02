import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Field, Input, Select, Tabs, Textarea } from '../../components/ui';
import ScriptItem from './ScriptItem';
import ScoringCard from './ScoringCard';
import VoicePicker from './VoicePicker';
import IssueText from './IssueText';
import {
  CALL_LENGTHS, CAMPAIGN_TYPES, LANGUAGES, RATE_PER_MINUTE, RETRY_OPTIONS,
  moveItem, newItem, normalizeItems,
} from './campaignModel';
import { incomingJumps } from './questionLogic';

/** A fixed line of the call — the opening or the sign-off — on the spine. */
function FixedLine({ icon, label, hint, issue, children }) {
  return (
    <li className="relative pl-11">
      <span aria-hidden="true" className="absolute left-0 top-0 flex size-7 items-center justify-center rounded-full bg-paper-400 dark:bg-white/10 text-muted-foreground">
        <span className="material-symbols-outlined [--icon-size:15px]">{icon}</span>
      </span>
      <p className="text-[13px] font-medium text-foreground leading-7">{label}</p>
      <div className="mt-1.5">{children}</div>
      {issue
        ? <IssueText issue={issue} />
        : hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </li>
  );
}

/**
 * Step 1: the call, top to bottom, as the person on the phone will hear it —
 * opening, questions, sign-off — with how it sounds (voice, language,
 * length) beside it. Nothing here is required beyond the questions.
 */
export default function ScriptStep({ payload, update, issues, draftNotes, onDismissNotes }) {
  const [focusId, setFocusId] = useState(null);
  // One line is open for editing at a time; the rest stay folded to the
  // question and what it does, so the whole call reads at a glance.
  const [activeId, setActiveId] = useState(null);
  const items = payload.dataToCollect || [];
  const goals = payload.goals || {};
  const settings = payload.callSettings || {};
  const jumps = incomingJumps(items);

  // Clicking or tabbing anywhere but a script line folds the open one.
  useEffect(() => {
    if (!activeId) return undefined;
    const leave = (e) => { if (!e.target.closest?.('[data-script-line]')) setActiveId(null); };
    document.addEventListener('mousedown', leave);
    document.addEventListener('focusin', leave);
    return () => {
      document.removeEventListener('mousedown', leave);
      document.removeEventListener('focusin', leave);
    };
  }, [activeId]);

  const setItems = (next) => update({ dataToCollect: normalizeItems(next) });
  const setGoal = (key, value) => update({ goals: { ...goals, [key]: value } });
  const setSetting = (key, value) => update({ callSettings: { ...settings, [key]: value } });

  const insertAfter = (index, type = 'question') => {
    const item = newItem(type);
    const next = [...items];
    next.splice(index + 1, 0, item);
    setItems(next);
    setFocusId(item.id);
    setActiveId(item.id);
  };

  const lengths = CALL_LENGTHS.includes(settings.maxDuration) ? CALL_LENGTHS : [...CALL_LENGTHS, settings.maxDuration].sort((a, b) => a - b);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start animate-fade-in">
      <div className="flex flex-col gap-5 min-w-0">
        {draftNotes?.length > 0 && (
          <Alert tone="info" title="Your script is ready — a few things we assumed" onDismiss={onDismissNotes}>
            <ul className="mt-1 flex flex-col gap-1 list-disc pl-4">
              {draftNotes.map((note, i) => <li key={i}>{note}</li>)}
            </ul>
          </Alert>
        )}

        <Card>
          <Field
            label="What should these calls achieve?"
            hint={issues.fields.goal ? undefined : 'The agent keeps steering the conversation toward this.'}
          >
            <Input
              value={goals.goal || ''}
              onChange={(e) => setGoal('goal', e.target.value)}
              placeholder="e.g. Shortlist applicants for a first-round interview"
            />
          </Field>
          {issues.fields.goal && <IssueText issue={issues.fields.goal} />}
        </Card>

        <Card>
          <div className="flex items-baseline justify-between gap-4 mb-5">
            <h2 className="text-sm font-semibold text-foreground">The conversation</h2>
            <span className="text-xs text-muted-foreground">In the order the agent says it</span>
          </div>

          {/* The spine: a hairline joining every line of the call. */}
          <ol className="relative flex flex-col gap-3 before:absolute before:left-[13px] before:top-4 before:bottom-4 before:w-px before:bg-border">
            <FixedLine icon="call" label="Opening line" issue={issues.fields.callIntro} hint="[Name] becomes each person's name. The agent then confirms it's speaking to them.">
              <Textarea
                aria-label="Opening line"
                rows={2}
                value={goals.callIntro || ''}
                onChange={(e) => setGoal('callIntro', e.target.value)}
                placeholder="Hi [Name], this is an automated call from…"
              />
            </FixedLine>

            {items.map((item, index) => (
              <ScriptItem
                key={item.id}
                item={item}
                index={index}
                items={items}
                issue={issues.items[item.id]}
                active={item.id === activeId}
                autoFocus={item.id === focusId}
                incoming={jumps[item.id]}
                onActivate={() => setActiveId(item.id)}
                onChange={(next) => setItems(items.map(i => (i.id === item.id ? next : i)))}
                onRemove={() => setItems(items.filter(i => i.id !== item.id))}
                onMove={(dir) => setItems(moveItem(items, index, index + dir))}
                onEnter={() => insertAfter(index)}
              />
            ))}

            <li className="relative pl-11">
              <span aria-hidden="true" className="absolute left-0 top-0.5 flex size-7 items-center justify-center rounded-full border border-dashed border-paper-800 dark:border-white/25 bg-card dark:bg-muted text-muted-foreground">
                <span className="material-symbols-outlined [--icon-size:15px]">add</span>
              </span>
              <div className="flex flex-wrap gap-2">
                <Button variant="subtle" size="sm" icon="add" onClick={() => insertAfter(items.length - 1)}>Add a question</Button>
                <Button variant="ghost" size="sm" icon="campaign" onClick={() => insertAfter(items.length - 1, 'information')}>
                  Add something to say
                </Button>
              </div>
              {items.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Questions are what the agent asks and what each call is scored on.</p>
              )}
            </li>

            <FixedLine icon="call_end" label="Closing line" issue={issues.fields.callSignOff}>
              <Textarea
                aria-label="Closing line"
                rows={2}
                value={goals.callSignOff || ''}
                onChange={(e) => setGoal('callSignOff', e.target.value)}
                placeholder="Thank you for your time…"
              />
            </FixedLine>
          </ol>
        </Card>

        <ScoringCard payload={payload} update={update} setItems={setItems} />
      </div>

      {/* How it sounds. Sticky so it stays in reach beside a long script. */}
      <Card className="lg:sticky lg:top-5 flex flex-col gap-5">
        <h2 className="text-sm font-semibold text-foreground">How it sounds</h2>

        <div>
          <p className="text-[13px] font-medium text-foreground mb-1.5">Language</p>
          <Tabs
            size="sm"
            value={settings.language || 'English'}
            onChange={(v) => setSetting('language', v)}
            items={LANGUAGES.map(l => ({ value: l, label: l }))}
          />
        </div>

        <div>
          <p className="text-[13px] font-medium text-foreground mb-1.5">Voice</p>
          <VoicePicker
            value={settings.geminiVoice}
            onChange={(v) => setSetting('geminiVoice', v)}
            sampleText={goals.callIntro}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Longest call" hint={`Up to ₹${(settings.maxDuration || 5) * RATE_PER_MINUTE} each`}>
            <Select
              value={settings.maxDuration || 5}
              onChange={(e) => setSetting('maxDuration', Number(e.target.value))}
              className="text-xs"
            >
              {lengths.map(m => <option key={m} value={m}>{m} min</option>)}
            </Select>
          </Field>
          <Field label="No answer?" hint="Retries 20 min later">
            <Select
              value={settings.retryAttempts ?? 2}
              onChange={(e) => setSetting('retryAttempts', Number(e.target.value))}
              className="text-xs"
            >
              {RETRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        </div>

        <Field label="Campaign type" hint="Groups this campaign in reports.">
          <Select value={payload.type || 'HR'} onChange={(e) => update({ type: e.target.value })} className="text-xs">
            {CAMPAIGN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </Field>
      </Card>
    </div>
  );
}
