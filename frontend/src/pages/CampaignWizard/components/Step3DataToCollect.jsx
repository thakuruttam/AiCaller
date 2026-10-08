import React, { useRef, useState, useEffect } from 'react';
import { Button, IconButton, Input, WordLimitTextarea } from '../../../components/ui';
import { Plus, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react';
import QuestionCard from './QuestionCard';
import { emptyItem, uid } from './questionModel';
import { useToast } from '../../../context/ToastContext';

export default function Step3DataToCollect({ payload, updatePayload }) {
  const { addToast } = useToast();
  const items     = payload.dataToCollect || [];
  const endCallIf = payload.endCallIf || '';

  const dragFrom = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => {
    if (payload.dataToCollect?.some(i => !i.id)) {
      updatePayload({
        dataToCollect: payload.dataToCollect.map(i => ({ ...i, id: i.id || uid() }))
      });
    }
  }, [payload.dataToCollect]);

  useEffect(() => {
    if (!payload.dataToCollect) return;

    const questions = payload.dataToCollect.filter(i => i.itemType === 'question');
    if (questions.length === 0) return;

    let needsUpdate = false;
    let nextData = [...payload.dataToCollect];

    // Non-question items never carry a score weight.
    nextData = nextData.map(item => {
      if (item.itemType !== 'question') {
        if (item.weight !== 0) { needsUpdate = true; return { ...item, weight: 0 }; }
      }
      return item;
    });

    // Auto-balance questions the user hasn't manually weighted: split whatever
    // weight is left over after manually-set questions, not the full 100% —
    // otherwise a new question added after an existing one was hand-weighted
    // would be stuck at 0 forever instead of picking up the remainder.
    const autoQuestions = questions.filter(q => !q.isWeightManuallySet);
    if (autoQuestions.length > 0) {
      const usedWeight = questions
        .filter(q => q.isWeightManuallySet)
        .reduce((sum, q) => sum + (q.weight || 0), 0);
      const remaining = Math.max(0, 100 - usedWeight);
      const N = autoQuestions.length;
      const base = Math.floor(remaining / N);
      const rem  = remaining % N;
      nextData = nextData.map(item => {
        if (item.itemType !== 'question' || item.isWeightManuallySet) return item;
        const idx = autoQuestions.findIndex(q => q.id === item.id);
        const expected = idx < rem ? base + 1 : base;
        if (item.weight !== expected) { needsUpdate = true; return { ...item, weight: expected }; }
        return item;
      });
    }

    nextData = nextData.map(item => {
      if (item.itemType !== 'question') return item;
      const sfs = item.fieldsToExtract || [];
      if (sfs.length === 0) return item;

      const anySubManual = sfs.some(sf => sf.isWeightManuallySet);
      if (anySubManual) return item;

      const qWeight = item.weight || 0;
      const M    = sfs.length;
      const base = Math.floor(qWeight / M);
      const rem  = qWeight % M;

      let sfChanged = false;
      const newSfs = sfs.map((sf, idx) => {
        const expected = idx < rem ? base + 1 : base;
        if (sf.weight !== expected) { sfChanged = true; return { ...sf, weight: expected }; }
        return sf;
      });

      if (sfChanged) { needsUpdate = true; return { ...item, fieldsToExtract: newSfs }; }
      return item;
    });

    if (needsUpdate) updatePayload({ dataToCollect: nextData });
  }, [payload.dataToCollect]);

  const setItems = (next) => updatePayload({ dataToCollect: next });
  const setEndCallIf = (v) => updatePayload({ endCallIf: v });

  const addItem = () => {
    setItems([...items, emptyItem(items.length + 1)]);
  };

  const updateItem = (id, updated) => {
    setItems(items.map(i => i.id === id ? updated : i));
  };

  const removeItem = (id) => {
    const filtered = items.filter(i => i.id !== id).map((i, idx) => ({ ...i, order: idx + 1 }));
    setItems(filtered);
  };

  const handleDragStart = (idx) => { dragFrom.current = idx; };
  const handleDragOver  = (idx) => { setDragOver(idx); };
  const handleDrop      = (toIdx) => {
    const from = dragFrom.current;
    if (from === null || from === toIdx) { dragFrom.current = null; setDragOver(null); return; }
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(toIdx, 0, moved);

    const validated = next.map((item, idx) => {
      if (item.onAnswer?.action === 'skip_question' && item.onAnswer.skipToId) {
        const targetIdx = next.findIndex(q => q.id === item.onAnswer.skipToId);
        if (targetIdx <= idx) {
          return { ...item, onAnswer: { ...item.onAnswer, action: 'continue', skipToId: '' } };
        }
      }
      return item;
    });

    setItems(validated.map((i, idx) => ({ ...i, order: idx + 1 })));
    addToast("Question sequence updated successfully!", "success");
    dragFrom.current = null;
    setDragOver(null);
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      {/* Question list */}
      <div className="flex flex-col gap-3">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-paper-500 dark:border-ink-400 rounded-card text-muted-foreground bg-paper-200 dark:bg-ink-50">
            <MessageSquare size={32} className="mb-2 opacity-40" />
            <p className="text-sm">No questions yet. Add one below.</p>
          </div>
        )}
        {items.map((item, idx) => (
          <QuestionCard
            // Items arriving from a saved campaign may not carry an id yet —
            // the effect above backfills one, but that lands after this first
            // render, so fall back to the index for that single pass.
            key={item.id || `item-${idx}`}
            item={item}
            allItems={items}
            index={idx}
            onUpdate={(updated) => updateItem(item.id, updated)}
            onRemove={() => removeItem(item.id)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            isDraggedOver={dragOver === idx}
          />
        ))}
      </div>

      {/* Weight total indicator */}
      {items.length > 0 && (() => {
        const total = items.reduce((sum, i) => {
          if (i.itemType !== 'question') return sum;
          const sfs = i.fieldsToExtract || [];
          if (sfs.length > 0) return sum + sfs.reduce((s, sf) => s + (sf.weight || 0), 0);
          return sum + (i.weight || 0);
        }, 0);
        const over  = total > 100;
        const exact = total === 100;
        return (
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-control border text-sm font-medium
            ${over  ? 'border-negative/25 bg-negative/10 text-negative-dim'
            : exact ? 'border-positive bg-positive/10 text-positive-dim'
            :         'border-paper-500 dark:border-ink-400 bg-paper-200 dark:bg-ink-50 text-muted-foreground'}`}
          >
            <span>Total Call Score Weight</span>
            <span className="tabular-nums">{total}%
              {over  && ' — exceeds 100%'}
              {exact && ' ✓ perfect'}
              {!over && !exact && ` — ${100 - total}% unallocated`}
            </span>
          </div>
        );
      })()}

      {/* Add button */}
      <Button variant="subtle" size="lg" type="button" onClick={addItem}>
        <Plus size={16} /> Add Question / Information
      </Button>

      {/* End Call If */}
      <div className="flex flex-col gap-3 p-4 rounded-card border border-negative/25 bg-negative/10">
        <div className="flex items-center gap-2">
          <AlertCircle size={15} className="text-negative-dim" />
          <label htmlFor="end-call-if" className="text-sm font-semibold text-negative-dim">End Call If</label>
          <span className="text-xs font-medium text-negative">(max 500 words)</span>
        </div>
        <p className="text-xs font-medium text-negative-dim/80 leading-relaxed">
          Describe any condition(s) under which the bot should immediately end the call. For example: <em>"If the contact says they are not interested at any point, immediately end the call."</em>
        </p>
        <WordLimitTextarea
          id="end-call-if"
          value={endCallIf}
          onChange={setEndCallIf}
          limit={500}
          placeholder="e.g. End the call if the contact is abusive, not the intended person, or says they are not interested."
          rows={3}
        />
      </div>

      {/* Success Score Threshold */}
      <div className="flex flex-col gap-3 p-4 rounded-card border border-paper-500 dark:border-ink-400 bg-paper-200 dark:bg-ink-50">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={15} className="text-positive-dim" />
          <label htmlFor="success-score" className="text-sm font-semibold text-foreground">Success Score Threshold</label>
        </div>
        <p className="text-xs font-medium text-muted-foreground leading-relaxed">
          Calls whose final score falls below this threshold will be marked as <strong>Failed</strong> in reports.
        </p>
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center gap-4">
            <div className="w-24">
              <Input
                id="success-score"
                type="number"
                min={0}
                max={100}
                className="text-center tabular-nums"
                value={payload.rules?.successScore ?? 50}
                onChange={(e) => updatePayload({ rules: { ...payload.rules, successScore: Math.min(100, Math.max(0, Number(e.target.value))) } })}
              />
            </div>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <div className="relative h-2 rounded-full bg-paper-500 dark:bg-ink-300 overflow-hidden w-full max-w-sm mt-1">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-positive transition-all"
              style={{ width: `${payload.rules?.successScore ?? 50}%` }}
            />
          </div>
          <p className="text-xs font-medium text-muted-foreground">
            Current threshold: <strong className="text-muted-foreground">{payload.rules?.successScore ?? 50}%</strong>. Calls scoring below this are unsuccessful.
          </p>
        </div>
      </div>
    </div>
  );
}
