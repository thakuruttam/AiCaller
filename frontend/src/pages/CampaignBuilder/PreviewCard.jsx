import React, { useContext } from 'react';
import { Card, Select } from '../../components/ui';
import { renderText } from '../../lib/contactVariables';
import { VariablesContext } from './variablesContext';

function Line({ label, text, variables, person }) {
  if (!text?.trim()) return null;
  const { text: filled, missing, unknown } = renderText(text, { variables, values: person?.parsed, contactName: person?.name });
  const gaps = [...missing.map(id => variables.find(v => v.id === id)?.key).filter(Boolean), ...unknown];
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-[13px] text-foreground mt-0.5 whitespace-pre-wrap">{filled}</p>
      {gaps.length > 0 && (
        <p className="text-[11px] text-caution-dim dark:text-caution mt-0.5">
          No value for {gaps.map(g => `{{${g}}}`).join(', ')} — {missing.length ? 'its “if empty” text is used' : "it isn't a column yet"}.
        </p>
      )}
    </div>
  );
}

/**
 * How the call reads for one real person: pick anyone on the list and see
 * the opening, goal, closing (and questions) with their values filled in —
 * the same fill-in a live call uses.
 */
export default function PreviewCard({ payload }) {
  const ctx = useContext(VariablesContext);
  const contacts = payload.contacts || [];
  if (!ctx || !contacts.length) return null;
  const person = ctx.person;
  const variables = ctx.idVariables;
  const questions = (payload.dataToCollect || []).filter(i => i.text?.trim()).slice(0, 4);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Preview</h2>
        <Select
          aria-label="Preview as"
          value={ctx.personIndex}
          onChange={(e) => ctx.setPersonIndex(Number(e.target.value))}
          className="!h-8 !w-auto max-w-[180px] text-xs"
        >
          {contacts.slice(0, 200).map((c, i) => <option key={`${c.phone}-${i}`} value={i}>{c.name}</option>)}
        </Select>
      </div>
      <Line label="Opening line" text={ctx.toIds(payload.goals?.callIntro)} variables={variables} person={person} />
      <Line label="Goal" text={ctx.toIds(payload.goals?.goal)} variables={variables} person={person} />
      {payload.mode !== 'conversation' && questions.map((q, i) => (
        <Line key={q.id || i} label={`Question ${i + 1}`} text={ctx.toIds(q.text)} variables={variables} person={person} />
      ))}
      <Line label="Closing line" text={ctx.toIds(payload.goals?.callSignOff)} variables={variables} person={person} />
    </Card>
  );
}
