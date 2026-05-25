import React, { useRef, useState, useEffect } from 'react';
import { Plus, MessageSquare, AlertCircle, CheckCircle2 } from 'lucide-react';
import QuestionCard, { emptyItem, uid } from './QuestionCard';
import { useToast } from '../../../context/ToastContext';

function WordLimitTextarea({ value, onChange, limit, placeholder, className = '', rows = 2 }) {
  const count = value?.trim().split(/\s+/).filter(Boolean).length || 0;
  const over  = count > limit;
  return (
    <div className="relative flex flex-col w-full">
      <textarea
        rows={rows}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-md border bg-background px-3 pt-2 pb-6 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y transition-colors
          ${over ? 'border-destructive focus-visible:ring-destructive' : 'border-input'} ${className}`}
      />
      <div className={`absolute bottom-2 right-6 text-[10px] pointer-events-none tabular-nums bg-background/80 px-1 backdrop-blur-sm rounded ${over ? 'text-destructive font-semibold' : 'text-muted-foreground/70'}`}>
        {count} / {limit} words{over ? ' — over limit' : ''}
      </div>
    </div>
  );
}

export default function Step3DataToCollect({ payload, updatePayload }) {
  const { addToast } = useToast();
  const items      = payload.dataToCollect || [];
  const endCallIf  = payload.endCallIf || '';

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

    // 1. Auto-distribute question-level weights equally across all questions
    //    (only when no question weight has been manually set)
    const anyQuestionManual = questions.some(q => q.isWeightManuallySet);
    if (!anyQuestionManual) {
      const N = questions.length;
      const base = Math.floor(100 / N);
      const rem  = 100 % N;
      nextData = nextData.map(item => {
        if (item.itemType !== 'question') {
          if (item.weight !== 0) { needsUpdate = true; return { ...item, weight: 0 }; }
          return item;
        }
        const idx = questions.findIndex(q => q.id === item.id);
        const expected = idx < rem ? base + 1 : base;
        if (item.weight !== expected) { needsUpdate = true; return { ...item, weight: expected }; }
        return item;
      });
    }

    // 2. For each question with sub-fields, auto-distribute its own weight equally
    //    among sub-fields (only when no sub-field weight has been manually set)
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
    const next = [...items, emptyItem(items.length + 1)];
    setItems(next);
  };

  const updateItem = (id, updated) => {
    setItems(items.map(i => i.id === id ? updated : i));
  };

  const removeItem = (id) => {
    const filtered = items.filter(i => i.id !== id).map((i, idx) => ({ ...i, order: idx + 1 }));
    setItems(filtered);
  };

  // Drag-and-drop handlers
  const handleDragStart = (idx) => { dragFrom.current = idx; };
  const handleDragOver  = (idx) => { setDragOver(idx); };
  const handleDrop      = (toIdx) => {
    const from = dragFrom.current;
    if (from === null || from === toIdx) { dragFrom.current = null; setDragOver(null); return; }
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(toIdx, 0, moved);

    // Validate skips: clear any skip that doesn't point to a future item
    const validated = next.map((item, idx) => {
      if (item.onAnswer?.action === 'skip_question' && item.onAnswer.skipToId) {
        const targetIdx = next.findIndex(q => q.id === item.onAnswer.skipToId);
        if (targetIdx <= idx) {
          return {
            ...item,
            onAnswer: { ...item.onAnswer, action: 'continue', skipToId: '' }
          };
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
      <div>
        <h3 className="text-2xl font-semibold tracking-tight">Setup Questions</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Define what the AI bot will ask or convey, in order. Drag cards to reorder.
        </p>
      </div>

      {/* ── Question list ── */}
      <div className="flex flex-col gap-3">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-border rounded-xl text-muted-foreground bg-muted/10">
            <MessageSquare size={32} className="mb-2 opacity-40" />
            <p className="text-sm">No questions yet. Add one below.</p>
          </div>
        )}
        {items.map((item, idx) => (
          <QuestionCard
            key={item.id}
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

      {/* ── Weight total indicator ── */}
      {items.length > 0 && (() => {
        const total = items.reduce((sum, i) => {
          if (i.itemType !== 'question') return sum;
          const sfs = i.fieldsToExtract || [];
          if (sfs.length > 0) {
            return sum + sfs.reduce((s, sf) => s + (sf.weight || 0), 0);
          }
          return sum + (i.weight || 0);
        }, 0);
        const over  = total > 100;
        const exact = total === 100;
        return (
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium
            ${over  ? 'border-destructive bg-destructive/5 text-destructive'
            : exact ? 'border-green-500 bg-green-50 text-green-800'
            :         'border-border bg-muted/20 text-muted-foreground'}`}
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

      {/* ── Add button ── */}
      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border h-12 w-full text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all"
      >
        <Plus size={16} /> Add Question / Information
      </button>

      {/* ── End Call If ── */}
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
        <div className="flex items-center gap-2">
          <AlertCircle size={16} className="text-destructive" />
          <h4 className="text-sm font-semibold text-destructive">End Call If</h4>
          <span className="text-xs text-muted-foreground">(max 500 words)</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Describe any condition(s) under which the bot should immediately end the call, regardless of where it is in the flow. For example: <em>"If the contact says they are not interested at any point, immediately end the call."</em>
        </p>
        <WordLimitTextarea
          value={endCallIf}
          onChange={setEndCallIf}
          limit={500}
          placeholder="e.g. End the call if the contact is abusive, not the intended person, or says they are not interested."
          rows={3}
        />
      </div>

      {/* ── Passing Criteria (Success Score Threshold) ── */}
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-border bg-muted/10">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-600" />
          <h4 className="text-sm font-semibold text-foreground">Success Score Threshold</h4>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Calls whose final score falls below this threshold will be marked as <strong>Failed</strong> in reports.
        </p>
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-center gap-4">
            <input
              type="number"
              min={0}
              max={100}
              className="flex h-9 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={payload.rules?.successScore ?? 50}
              onChange={(e) => updatePayload({ rules: { ...payload.rules, successScore: Math.min(100, Math.max(0, Number(e.target.value))) } })}
            />
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>

          {/* Visual threshold bar */}
          <div className="relative h-2 rounded-full bg-muted overflow-hidden w-full max-w-sm mt-1">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-green-500 transition-all"
              style={{ width: `${payload.rules?.successScore ?? 50}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Current threshold: <strong>{payload.rules?.successScore ?? 50}%</strong>. Calls scoring below this are unsuccessful.
          </p>
        </div>
      </div>
    </div>
  );
}
