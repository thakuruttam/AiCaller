import React, { useRef, useState, useEffect } from 'react';
import { Plus, MessageSquare, AlertCircle } from 'lucide-react';
import QuestionCard, { emptyItem, uid } from './QuestionCard';

function WordLimitTextarea({ value, onChange, limit, placeholder, className = '', rows = 2 }) {
  const count = value?.trim().split(/\s+/).filter(Boolean).length || 0;
  const over  = count > limit;
  return (
    <div className="flex flex-col gap-0.5 w-full">
      <textarea
        rows={rows}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y transition-colors
          ${over ? 'border-destructive focus-visible:ring-destructive' : 'border-input'} ${className}`}
      />
      <span className={`text-xs text-right tabular-nums ${over ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
        {count}/{limit} words
      </span>
    </div>
  );
}

export default function Step3DataToCollect({ payload, updatePayload }) {
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
        const total = items.reduce((sum, i) => sum + (i.weight || 0), 0);
        const over  = total > 100;
        const exact = total === 100;
        return (
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium
            ${over  ? 'border-destructive bg-destructive/5 text-destructive'
            : exact ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
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
    </div>
  );
}
