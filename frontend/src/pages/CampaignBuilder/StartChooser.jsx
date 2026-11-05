import React, { useState } from 'react';
import { Button } from '../../components/ui';
import { CAMPAIGN_TYPES, CONVERSATION_TEMPLATES, MODES, TEMPLATES, conversationStart, plural } from './campaignModel';

const typeIcon = (type) => CAMPAIGN_TYPES.find(t => t.value === type)?.icon || 'campaign';

/** A starting-point tile: templates, and the blank conversation. */
function StartTile({ icon, title, blurb, meta, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left bg-card dark:bg-muted rounded-2xl shadow-primary p-5 cursor-pointer
                 border border-transparent hover:border-brand-500/25 transition-[border-color,transform] duration-200
                 hover:-translate-y-px outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30"
    >
      <span className="flex size-9 items-center justify-center rounded-control bg-brand-500/10 text-brand-600 dark:text-brand-300 mb-4">
        <span className="material-symbols-outlined [--icon-size:20px]">{icon}</span>
      </span>
      <span className="block text-sm font-semibold text-foreground">{title}</span>
      <span className="block text-[13px] text-muted-foreground mt-1">{blurb}</span>
      <span className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
        {meta}
        <span className="inline-flex items-center gap-1 font-medium text-brand-600 dark:text-brand-300 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
          Use this
          <span className="material-symbols-outlined [--icon-size:15px]">arrow_forward</span>
        </span>
      </span>
    </button>
  );
}

/** The kind of call: a question list, or a free conversation toward a goal. */
function ModeChoice({ mode, onChange }) {
  return (
    <div role="radiogroup" aria-label="Kind of call" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {MODES.map(m => {
        const selected = m.value === mode;
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(m.value)}
            className={`flex items-start gap-3 rounded-2xl border p-4 text-left cursor-pointer transition-colors
              outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30
              ${selected ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500' : 'border-border bg-card dark:bg-muted hover:border-paper-800 dark:hover:border-white/20'}`}
          >
            <span aria-hidden="true" className={`material-symbols-outlined [--icon-size:22px] mt-px ${selected ? 'text-brand-500' : 'text-muted-foreground'}`}>{m.icon}</span>
            <span>
              <span className="block text-sm font-semibold text-foreground">{m.label}</span>
              <span className="block text-[13px] text-muted-foreground mt-0.5">{m.blurb}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The first thing a new campaign shows: the kind of call, then a complete
 * template or a blank start. Every path lands in the same editor.
 */
export default function StartChooser({ onStart }) {
  const [mode, setMode] = useState('questions');

  if (mode === 'conversation') {
    return (
      <div className="flex flex-col gap-7 animate-rise">
        <ModeChoice mode={mode} onChange={setMode} />
        <section aria-labelledby="conversation-templates-heading">
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <h2 id="conversation-templates-heading" className="text-sm font-semibold text-foreground">Start from a ready-made brief</h2>
            <Button variant="link" size="sm" onClick={() => onStart(conversationStart())}>Start with a blank brief</Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 stagger">
            {CONVERSATION_TEMPLATES.map(tpl => (
              <StartTile key={tpl.key} icon={tpl.icon} title={tpl.title} blurb={tpl.blurb} meta="Conversation" onClick={() => onStart(conversationStart(tpl.key))} />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            You'll add what the agent knows — product, pricing, answers to objections — and test it in a chat before calling anyone.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7 animate-rise">
      <ModeChoice mode={mode} onChange={setMode} />
      <section aria-labelledby="templates-heading">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <h2 id="templates-heading" className="text-sm font-semibold text-foreground">Start from a ready-made script</h2>
          <Button variant="link" size="sm" onClick={() => onStart(null)}>Start with a blank script</Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 stagger">
          {TEMPLATES.map((tpl) => {
            const count = tpl.build().dataToCollect.filter(i => i.itemType === 'question').length;
            return (
              <StartTile key={tpl.type} icon={typeIcon(tpl.type)} title={tpl.title} blurb={tpl.blurb} meta={plural(count, 'question')} onClick={() => onStart(tpl.type)} />
            );
          })}
        </div>
      </section>
    </div>
  );
}
