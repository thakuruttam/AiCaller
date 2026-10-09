import React, { useState } from 'react';
import api from '../../../api/axios';
import { Button, Textarea, Alert } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';

/**
 * Describe the campaign in plain language; the product drafts it.
 *
 * This replaces hand-authoring six questions, assigning weight percentages
 * that must total 100, and picking comparison operators out of dropdowns.
 * Everything it produces lands in the same editable sections below, so this
 * is a starting point rather than a black box — and skipping it entirely
 * still leaves a fully usable manual builder.
 */
export default function BriefPanel({ onDraft, disabled }) {
  const { addToast } = useToast();
  const [brief, setBrief] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [unavailable, setUnavailable] = useState(null);
  const [result, setResult] = useState(null);

  const tooShort = brief.trim().length > 0 && brief.trim().length < 20;
  const canDraft = brief.trim().length >= 20 && !drafting && !disabled;

  const draft = async () => {
    if (!canDraft) return;
    setDrafting(true);
    setUnavailable(null);
    try {
      const { data } = await api.post('/api/campaigns/draft', { brief: brief.trim() });
      onDraft(data.payload);
      setResult({ assumptions: data.assumptions || [], corrections: data.corrections || [] });
      const n = (data.payload.dataToCollect || []).filter(i => i.itemType === 'question').length;
      addToast(`Drafted ${n} question${n === 1 ? '' : 's'} — review and edit below.`, 'success');
    } catch (err) {
      const code = err.response?.data?.code;
      const message = err.response?.data?.error || 'Could not draft this campaign.';
      // A server with no drafting credentials is a dead end for this panel
      // but not for the page — say so once and stay out of the way.
      if (code === 'DRAFTING_UNAVAILABLE') setUnavailable(message);
      else addToast(message, 'error');
    } finally {
      setDrafting(false);
    }
  };

  if (unavailable) {
    return (
      <Alert tone="caution" title="Drafting is switched off">
        {unavailable}
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Textarea
        id="campaign-brief"
        rows={4}
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        disabled={drafting || disabled}
        placeholder="Screen the 48 shortlisted diploma applicants. I need to know if they're still interested, their notice period, which city they'd relocate from, and their expected CTC. Drop anyone who has already accepted another offer."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={draft} loading={drafting} disabled={!canDraft} icon="auto_awesome">
          {drafting ? 'Drafting…' : result ? 'Draft again' : 'Draft this campaign'}
        </Button>
        <p className="text-xs text-muted-foreground">
          {tooShort
            ? 'A sentence or two more — who you are calling, and what you need to find out.'
            : 'Everything it writes stays editable below.'}
        </p>
      </div>

      {/* What the model inferred rather than read. Shown so review is
          informed — a confident-looking draft nobody checks is worse than
          no draft at all. */}
      {result && (result.assumptions.length > 0 || result.corrections.length > 0) && (
        <Alert tone="info" title="Worth checking before you start">
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {result.assumptions.map((a, i) => (
              <li key={`a${i}`} className="flex gap-2">
                <span aria-hidden="true">·</span><span>{a}</span>
              </li>
            ))}
            {result.corrections.map((c, i) => (
              <li key={`c${i}`} className="flex gap-2 text-caution-dim dark:text-caution">
                <span aria-hidden="true">·</span><span>{c}</span>
              </li>
            ))}
          </ul>
        </Alert>
      )}
    </div>
  );
}
