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
        className={`w-full rounded-lg border bg-white dark:bg-slate-700 px-3 pt-2 pb-6 text-sm text-zinc-900 dark:text-slate-100 placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 resize-y transition-colors
          ${over
            ? 'border-red-400 focus:ring-red-500/20'
            : 'border-zinc-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-indigo-500/20'
          } ${className}`}
      />
      <div className={`absolute bottom-2 right-6 text-[10px] pointer-events-none tabular-nums bg-white/90 dark:bg-slate-700/90 px-1 backdrop-blur-sm rounded ${over ? 'text-red-500 font-semibold' : 'text-zinc-400 dark:text-slate-500'}`}>
        {count} / {limit} words{over ? ' — over limit' : ''}
      </div>
    </div>
  );
}

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
      <div>
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-slate-100 tracking-tight">Setup Questions</h3>
        <p className="text-zinc-500 dark:text-slate-400 text-sm mt-1">
          Define what the AI bot will ask or convey, in order. Drag cards to reorder.
        </p>
      </div>

      {/* Question list */}
      <div className="flex flex-col gap-3">
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-zinc-200 dark:border-slate-700 rounded-xl text-zinc-400 dark:text-slate-500 bg-zinc-50 dark:bg-slate-900">
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
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm font-medium
            ${over  ? 'border-red-300 bg-red-50 text-red-700'
            : exact ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
            :         'border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-900 text-zinc-500 dark:text-slate-400'}`}
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
      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 dark:border-slate-700 h-12 w-full text-sm font-medium text-zinc-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
      >
        <Plus size={16} /> Add Question / Information
      </button>

      {/* End Call If */}
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-red-200 bg-red-50">
        <div className="flex items-center gap-2">
          <AlertCircle size={15} className="text-red-600" />
          <h4 className="text-sm font-semibold text-red-700">End Call If</h4>
          <span className="text-xs text-red-500">(max 500 words)</span>
        </div>
        <p className="text-xs text-red-600/80 leading-relaxed">
          Describe any condition(s) under which the bot should immediately end the call. For example: <em>"If the contact says they are not interested at any point, immediately end the call."</em>
        </p>
        <WordLimitTextarea
          value={endCallIf}
          onChange={setEndCallIf}
          limit={500}
          placeholder="e.g. End the call if the contact is abusive, not the intended person, or says they are not interested."
          rows={3}
        />
      </div>

      {/* Success Score Threshold */}
      <div className="flex flex-col gap-3 p-4 rounded-xl border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={15} className="text-emerald-600" />
          <h4 className="text-sm font-semibold text-zinc-800 dark:text-slate-200">Success Score Threshold</h4>
        </div>
        <p className="text-xs text-zinc-500 dark:text-slate-400 leading-relaxed">
          Calls whose final score falls below this threshold will be marked as <strong>Failed</strong> in reports.
        </p>
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex items-center gap-4">
            <input
              type="number"
              min={0}
              max={100}
              className="flex h-9 w-24 rounded-lg border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 text-sm text-zinc-900 dark:text-slate-100 text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              value={payload.rules?.successScore ?? 50}
              onChange={(e) => updatePayload({ rules: { ...payload.rules, successScore: Math.min(100, Math.max(0, Number(e.target.value))) } })}
            />
            <span className="text-sm text-zinc-500 dark:text-slate-400">/ 100</span>
          </div>
          <div className="relative h-2 rounded-full bg-zinc-200 dark:bg-slate-700 overflow-hidden w-full max-w-sm mt-1">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${payload.rules?.successScore ?? 50}%` }}
            />
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-slate-400">
            Current threshold: <strong className="text-zinc-700 dark:text-slate-300">{payload.rules?.successScore ?? 50}%</strong>. Calls scoring below this are unsuccessful.
          </p>
        </div>
      </div>
    </div>
  );
}
