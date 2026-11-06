import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, Field, Input, Textarea } from '../../components/ui';
import ScriptItem from './ScriptItem';
import ScoringCard from './ScoringCard';
import SoundSettings from './SoundSettings';
import ConversationStep from './ConversationStep';
import IssueText from './IssueText';
import VariableText from './VariableText';
import PreviewCard from './PreviewCard';
import { moveItem, newItem, normalizeItems } from './campaignModel';
import { incomingJumps } from './questionLogic';

/** A fixed line of the call — the opening or the sign-off — on the spine. */
export function FixedLine({ icon, label, hint, issue, children }) {
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
export default function ScriptStep(props) {
  return props.payload.mode === 'conversation' ? <ConversationStep {...props} /> : <QuestionScript {...props} />;
}

function QuestionScript({ payload, update, issues, draftNotes, onDismissNotes }) {
  const [focusId, setFocusId] = useState(null);
  // One line is open for editing at a time; the rest stay folded to the
  // question and what it does, so the whole call reads at a glance.
  const [activeId, setActiveId] = useState(null);
  const items = payload.dataToCollect || [];
  const goals = payload.goals || {};
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

  const insertAfter = (index, type = 'question') => {
    const item = newItem(type);
    const next = [...items];
    next.splice(index + 1, 0, item);
    setItems(next);
    setFocusId(item.id);
    setActiveId(item.id);
  };

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
            <VariableText
              value={goals.goal || ''}
              onChange={(v) => setGoal('goal', v)}
              hint
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

          {/* The spine: a hairline joining every line of the call. Capped
              and scrolled internally once there are enough questions,
              rather than growing the page. */}
          <ol className="relative flex flex-col gap-3 max-h-[55vh] overflow-y-auto before:absolute before:left-[13px] before:top-4 before:bottom-4 before:w-px before:bg-border">

            <FixedLine icon="call" label="Opening line" issue={issues.fields.callIntro} hint="[Name] becomes each person's name. The agent then confirms it's speaking to them.">
              <VariableText
                as="textarea"
                aria-label="Opening line"
                rows={2}
                value={goals.callIntro || ''}
                onChange={(v) => setGoal('callIntro', v)}
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
              <VariableText
                as="textarea"
                aria-label="Closing line"
                rows={2}
                value={goals.callSignOff || ''}
                onChange={(v) => setGoal('callSignOff', v)}
                placeholder="Thank you for your time…"
              />
            </FixedLine>
          </ol>
        </Card>

        <ScoringCard payload={payload} update={update} setItems={setItems} />
      </div>

      {/* How it sounds. Sticky so it stays in reach beside a long script;
          top-28 clears the sticky step header above (name + stepper). */}
      <div className="flex flex-col gap-5 lg:sticky lg:top-28 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
        <PreviewCard payload={payload} />
        <SoundSettings payload={payload} update={update} />
      </div>
    </div>
  );
}
