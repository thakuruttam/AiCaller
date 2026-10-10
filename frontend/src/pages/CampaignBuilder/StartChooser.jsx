import React, { useState } from 'react';
import api from '../../api/axios';
import { Alert, Button, Card, Textarea } from '../../components/ui';
import { CAMPAIGN_TYPES, TEMPLATES, plural } from './campaignModel';

const typeIcon = (type) => CAMPAIGN_TYPES.find(t => t.value === type)?.icon || 'campaign';

/**
 * The first thing a new campaign shows: three ways in, none of them a form.
 * Describing it lets the server draft the whole script; a template gives a
 * complete, editable script instantly; blank is for people who know exactly
 * what they want. Every path lands in the same editor.
 */
export default function StartChooser({ onStart }) {
  const [brief, setBrief] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  const ready = brief.trim().length >= 20;

  const draft = async () => {
    if (!ready || drafting) return;
    setDrafting(true);
    setError(null);
    try {
      const { data } = await api.post('/api/campaigns/draft', { brief: brief.trim() });
      onStart(data.payload, [...(data.assumptions || []), ...(data.corrections || [])]);
    } catch (err) {
      const status = err.response?.status;
      // No drafting credentials (503) or an API that predates drafting (404):
      // a dead end for this box, not for the page — say so once and point at
      // the templates, which need nothing from the server.
      if (status === 404 || err.response?.data?.code === 'DRAFTING_UNAVAILABLE') setUnavailable(true);
      else setError(err.response?.data?.error || 'Could not write a script just now. Try again, or pick a template.');
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div className="flex flex-col gap-7 animate-rise">
      <Card>
        <div className="flex items-start gap-3 mb-4">
          <span className="material-symbols-outlined [--icon-size:20px] text-brand-500 mt-0.5">auto_awesome</span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Describe the calls you want to make</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Say who you're calling and what you need to find out. We'll write the script — you can change any of it.
            </p>
          </div>
        </div>

        {unavailable ? (
          <Alert tone="caution" title="Writing from a description isn't switched on yet">
            Pick a template below instead — it gives you a complete script to edit.
          </Alert>
        ) : (
          <>
            <Textarea
              aria-label="Describe your calls"
              rows={3}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) draft(); }}
              disabled={drafting}
              placeholder="e.g. Call the 48 diploma applicants. Check they're still interested, their notice period and expected salary. Stop the call if they've already taken another offer."
            />
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <Button onClick={draft} loading={drafting} disabled={!ready} icon="auto_awesome">
                {drafting ? 'Writing your script…' : 'Write my script'}
              </Button>
              <span className="text-xs text-muted-foreground">
                {brief.trim() && !ready ? 'A little more detail — who you are calling, and what you need to know.' : 'Takes about 20 seconds.'}
              </span>
            </div>
            {error && <Alert tone="negative" title={error} className="mt-4" />}
          </>
        )}
      </Card>

      <section aria-labelledby="templates-heading">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <h2 id="templates-heading" className="text-sm font-semibold text-foreground">Or start from a ready-made script</h2>
          <Button variant="link" size="sm" onClick={() => onStart(null)}>Start with a blank script</Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 stagger">
          {TEMPLATES.map((tpl) => {
            const count = tpl.build().dataToCollect.filter(i => i.itemType === 'question').length;
            return (
              <button
                key={tpl.type}
                type="button"
                onClick={() => onStart(tpl.type)}
                className="group text-left bg-card dark:bg-muted rounded-2xl shadow-primary p-5 cursor-pointer
                           border border-transparent hover:border-brand-500/25 transition-[border-color,transform] duration-200
                           hover:-translate-y-px outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30"
              >
                <span className="flex size-9 items-center justify-center rounded-control bg-brand-500/10 text-brand-600 dark:text-brand-300 mb-4">
                  <span className="material-symbols-outlined [--icon-size:20px]">{typeIcon(tpl.type)}</span>
                </span>
                <span className="block text-sm font-semibold text-foreground">{tpl.title}</span>
                <span className="block text-[13px] text-muted-foreground mt-1">{tpl.blurb}</span>
                <span className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
                  {plural(count, 'question')}
                  <span className="inline-flex items-center gap-1 font-medium text-brand-600 dark:text-brand-300 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                    Use this
                    <span className="material-symbols-outlined [--icon-size:15px]">arrow_forward</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
