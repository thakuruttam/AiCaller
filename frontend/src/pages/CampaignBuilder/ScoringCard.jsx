import React, { useState } from 'react';
import { Button, Card, Field, Input, Textarea } from '../../components/ui';
import { itemWeight, totalWeight } from './campaignModel';
import { goodAnswerLabel, readLogic } from './questionLogic';

/**
 * Everything about the call as a whole: when to hang up early, the pass mark,
 * and how the score is shared between questions. Shares are a property of the
 * set, not of one question, so they're edited side by side here — next to
 * what each question scores on — rather than one at a time inside each.
 */
export default function ScoringCard({ payload, update, setItems }) {
  const [open, setOpen] = useState(false);
  const items = payload.dataToCollect || [];
  const questions = items.map((item, idx) => ({ item, n: idx + 1 })).filter(({ item }) => item.itemType !== 'information');
  const even = 100 / (questions.length || 1);
  const custom = questions.some(({ item }) => Math.abs(itemWeight(item) - even) >= 1);
  const total = totalWeight(items);
  const pass = payload.rules?.successScore ?? 50;

  const setWeight = (id, value) => setItems(items.map(i => (i.id !== id ? i : {
    ...i,
    weight: Math.min(100, Math.max(0, Number(value) || 0)),
    isWeightManuallySet: true,
    // A question's share is split across the details it saves.
    fieldsToExtract: (i.fieldsToExtract || []).map(sf => ({ ...sf, isWeightManuallySet: false })),
  })));
  const shareEvenly = () => setItems(items.map(i => ({ ...i, isWeightManuallySet: false })));

  const summary = [
    `Pass mark ${pass}`,
    custom ? 'custom score split' : 'questions count equally',
    payload.endCallIf?.trim() && `hangs up early if: ${payload.endCallIf.trim()}`,
  ].filter(Boolean).join(' · ');

  return (
    <Card padded={false}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="call-rules"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-5 text-left cursor-pointer rounded-2xl outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30"
      >
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-foreground">Scoring and call rules <span className="font-normal text-muted-foreground">· optional</span></span>
          <span className="block text-xs text-muted-foreground mt-0.5 truncate">{summary}</span>
        </span>
        <span className={`material-symbols-outlined [--icon-size:20px] text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}>expand_more</span>
      </button>

      {open && (
        <div id="call-rules" className="border-t border-border p-5 flex flex-col gap-6 animate-fade-in">
          {questions.length > 0 && (
            <section aria-label="How the score is split" className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[13px] font-medium text-foreground">How the score is split</h3>
                {custom && <Button variant="link" size="sm" onClick={shareEvenly}>Count them equally</Button>}
              </div>
              <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {questions.map(({ item, n }) => {
                  const good = goodAnswerLabel(readLogic(item));
                  return (
                    <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                      <span className="w-5 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">{n}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[13px] text-foreground">{item.text || 'Untitled question'}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                          {good && <span className="material-symbols-outlined [--icon-size:13px] text-caution-dim dark:text-caution" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>}
                          <span className="truncate">{good ? `Scores: ${good}` : 'Any answer scores'}</span>
                        </span>
                      </span>
                      <span className="w-20 shrink-0">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          aria-label={`Question ${n} share of the score`}
                          value={itemWeight(item)}
                          onChange={(e) => setWeight(item.id, e.target.value)}
                          trailing={<span className="pr-1 text-xs text-muted-foreground">%</span>}
                          className="!h-8 !pr-7 tabular-nums"
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className={`text-xs text-right ${total > 100 ? 'text-negative-dim dark:text-negative' : total < 100 ? 'text-caution-dim dark:text-caution' : 'text-muted-foreground'}`}>
                Total {total}%{total !== 100 && ' — should add up to 100%'}
              </p>
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px] gap-5">
            <Field label="Hang up early if…" hint="Checked against everything the person says, at any point in the call.">
              <Textarea
                rows={2}
                value={payload.endCallIf || ''}
                onChange={(e) => update({ endCallIf: e.target.value })}
                placeholder="e.g. They ask not to be called again, or it's the wrong person."
              />
            </Field>
            <Field label="Pass mark" hint="Calls scoring below this are marked unsuccessful.">
              <Input
                type="number"
                min={0}
                max={100}
                value={pass}
                onChange={(e) => update({ rules: { ...payload.rules, successScore: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } })}
                trailing={<span className="pr-1.5 text-xs text-muted-foreground">/ 100</span>}
                className="tabular-nums"
              />
            </Field>
          </div>
        </div>
      )}
    </Card>
  );
}
