import React, { useState, useRef } from 'react';
import {
  PhoneIncoming, MessageSquare, X,
  CheckCircle, AlertCircle, PhoneOff,
  User, Plus
} from 'lucide-react';
import QuestionCard, { emptyItem } from './QuestionCard';
import { useToast } from '../../../context/ToastContext';

function wordCount(t) { return t?.trim().split(/\s+/).filter(Boolean).length || 0; }

function WordLimitTextarea({ value, onChange, limit, placeholder, rows = 2 }) {
  const count = wordCount(value);
  const over  = count > limit;
  return (
    <div className="flex flex-col gap-0.5 w-full">
      <textarea rows={rows} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full rounded-lg border bg-white dark:bg-slate-700 px-3 py-2 text-sm text-zinc-900 dark:text-slate-100 placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 resize-y transition-colors
          ${over
            ? 'border-red-400 focus:ring-red-500/20'
            : 'border-zinc-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-indigo-500/20'
          }`} />
      <span className={`text-xs text-right tabular-nums ${over ? 'text-red-500 font-semibold' : 'text-zinc-400'}`}>{count}/{limit} words</span>
    </div>
  );
}

// ── Call Design Modal ─────────────────────────────────────────────────────────
function CallDesignModal({ contact, campaignGoals, onSave, onClose }) {
  const current = contact.overrides?.goals ?? { ...campaignGoals };
  const [local, setLocal] = useState({ ...current });
  const set = (k, v) => setLocal(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div>
            <h4 className="font-semibold text-base text-zinc-900 dark:text-slate-100">Customize Call Design</h4>
            <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">Overrides for <span className="font-medium text-zinc-900 dark:text-slate-100">{contact.name}</span> only</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-slate-700 text-zinc-400 dark:text-slate-500 hover:text-zinc-700 dark:hover:text-slate-300 transition-colors"><X size={16} /></button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-600 dark:text-slate-400 flex items-center gap-1"><MessageSquare size={11} /> Campaign Goal <span className="font-normal text-zinc-400 dark:text-slate-500">(max 100 words)</span></label>
            <WordLimitTextarea value={local.goal} onChange={v => set('goal', v)} limit={100} placeholder="Override the campaign goal for this contact…" rows={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-600 dark:text-slate-400 flex items-center gap-1"><PhoneIncoming size={11} /> Call Introduction <span className="font-normal text-zinc-400 dark:text-slate-500">(max 300 words)</span></label>
            <WordLimitTextarea value={local.callIntro} onChange={v => set('callIntro', v)} limit={300} placeholder="Custom opening script for this contact…" rows={3} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-600 dark:text-slate-400 flex items-center gap-1"><PhoneOff size={11} /> Call Sign-off <span className="font-normal text-zinc-400 dark:text-slate-500">(max 300 words)</span></label>
            <WordLimitTextarea value={local.callSignOff} onChange={v => set('callSignOff', v)} limit={300} placeholder="Custom closing script for this contact…" rows={3} />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-200 dark:border-slate-700 sticky bottom-0 bg-white dark:bg-slate-800">
          <button onClick={onClose} className="inline-flex items-center h-9 px-4 rounded-lg border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50 transition-colors shadow-sm">Cancel</button>
          <button onClick={() => { onSave({ goals: local }); onClose(); }}
            className="inline-flex items-center h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">Save Overrides</button>
        </div>
      </div>
    </div>
  );
}

// ── Setup Questions Modal ─────────────────────────────────────────────────────
function QuestionsModal({ contact, campaignQuestions, onSave, onClose }) {
  const { addToast } = useToast();
  const base = contact.overrides?.dataToCollect ?? campaignQuestions.map(q => ({ ...q }));
  const [local, setLocal] = useState(base.map(q => ({ ...q })));

  const dragFrom = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const addItem = () => {
    setLocal([...local, emptyItem(local.length + 1)]);
  };

  const update = (id, updated) => {
    setLocal(prev => prev.map(q => q.id === id ? updated : q));
  };

  const remove = (id) => {
    setLocal(local.filter(i => i.id !== id).map((i, idx) => ({ ...i, order: idx + 1 })));
  };

  const handleDragStart = (idx) => { dragFrom.current = idx; };
  const handleDragOver  = (idx) => { setDragOver(idx); };
  const handleDrop      = (toIdx) => {
    const from = dragFrom.current;
    if (from === null || from === toIdx) { dragFrom.current = null; setDragOver(null); return; }
    const next = [...local];
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

    setLocal(validated.map((i, idx) => ({ ...i, order: idx + 1 })));
    addToast("Question sequence updated successfully!", "success");
    dragFrom.current = null;
    setDragOver(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 border border-zinc-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div>
            <h4 className="font-semibold text-base text-zinc-900 dark:text-slate-100">Customize Setup Questions</h4>
            <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">Overrides for <span className="font-medium text-zinc-900 dark:text-slate-100">{contact.name}</span> only</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-slate-700 text-zinc-400 dark:text-slate-500 hover:text-zinc-700 dark:hover:text-slate-300 transition-colors"><X size={16} /></button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {local.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-zinc-200 dark:border-slate-700 rounded-xl text-zinc-400 dark:text-slate-500 bg-zinc-50 dark:bg-slate-900">
                <MessageSquare size={32} className="mb-2 opacity-40" />
                <p className="text-sm">No questions yet. Add one below.</p>
              </div>
            )}
            {local.map((item, idx) => (
              <QuestionCard
                key={item.id}
                item={item}
                allItems={local}
                index={idx}
                onUpdate={(updated) => update(item.id, updated)}
                onRemove={() => remove(item.id)}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDraggedOver={dragOver === idx}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 dark:border-slate-700 h-10 w-full text-xs font-medium text-zinc-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all mt-2"
          >
            <Plus size={14} /> Add Question / Information
          </button>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-200 dark:border-slate-700 sticky bottom-0 bg-white dark:bg-slate-800">
          <button onClick={onClose} className="inline-flex items-center h-9 px-4 rounded-lg border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50 transition-colors shadow-sm">Cancel</button>
          <button onClick={() => { onSave({ dataToCollect: local }); onClose(); }}
            className="inline-flex items-center h-9 px-4 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">Save Overrides</button>
        </div>
      </div>
    </div>
  );
}

// ── Contact Row ───────────────────────────────────────────────────────────────
function ContactRow({ contact, index, campaignGoals, campaignQuestions, onSave }) {
  const [modal, setModal] = useState(null);

  const hasDesignOverride    = !!contact.overrides?.goals;
  const hasQuestionsOverride = !!contact.overrides?.dataToCollect;

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
            {contact.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-slate-100">{contact.name}</p>
            <p className="text-xs text-zinc-500 dark:text-slate-400 font-mono">{contact.phone}</p>
          </div>
          <div className="flex gap-1 ml-2">
            {hasDesignOverride    && <span className="text-xs px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700">Design ✓</span>}
            {hasQuestionsOverride && <span className="text-xs px-2 py-0.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700">Questions ✓</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setModal('questions')}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50 transition-colors shadow-sm">
            <MessageSquare size={11} /> Setup Questions
          </button>
          <button onClick={() => setModal('design')}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50 transition-colors shadow-sm">
            <PhoneIncoming size={11} /> Call Design
          </button>
        </div>
      </div>

      {modal === 'design' && (
        <CallDesignModal contact={contact} campaignGoals={campaignGoals}
          onSave={(patch) => onSave(index, patch)} onClose={() => setModal(null)} />
      )}
      {modal === 'questions' && (
        <QuestionsModal contact={contact} campaignQuestions={campaignQuestions}
          onSave={(patch) => onSave(index, patch)} onClose={() => setModal(null)} />
      )}
    </>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StepContactOverrides({ payload, updatePayload }) {
  const contacts          = payload.contacts         || [];
  const campaignGoals     = payload.goals            || {};
  const campaignQuestions = payload.dataToCollect    || [];

  const saveOverride = (index, patch) => {
    const updated = contacts.map((c, i) =>
      i === index ? { ...c, overrides: { ...(c.overrides || {}), ...patch } } : c
    );
    updatePayload({ contacts: updated });
  };

  const overrideCount = contacts.filter(c => c.overrides?.goals || c.overrides?.dataToCollect).length;

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-slate-100 tracking-tight">Contact Customization</h3>
        <p className="text-zinc-500 dark:text-slate-400 text-sm mt-1">
          Override the campaign defaults for any individual contact. Other contacts are unaffected.
        </p>
      </div>

      {overrideCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-violet-300 bg-violet-50 text-violet-800 text-sm font-medium">
          <CheckCircle size={14} />
          {overrideCount} contact{overrideCount > 1 ? 's have' : ' has'} custom overrides
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 border-2 border-dashed border-zinc-200 dark:border-slate-700 rounded-xl text-zinc-400 dark:text-slate-500 bg-zinc-50 dark:bg-slate-900">
          <User size={32} className="mb-2 opacity-40" />
          <p className="text-sm">No contacts uploaded yet. Go back to Step 2 to add contacts.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {contacts.map((c, i) => (
            <ContactRow
              key={c.phone + i}
              contact={c}
              index={i}
              campaignGoals={campaignGoals}
              campaignQuestions={campaignQuestions}
              onSave={saveOverride}
            />
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 p-3 rounded-lg border border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-900 text-xs text-zinc-500 dark:text-slate-400">
        <AlertCircle size={12} className="mt-0.5 shrink-0 text-zinc-400 dark:text-slate-500" />
        <span>Overrides are saved locally in the wizard. When the campaign is launched, each contact's call will use its custom settings if set, falling back to campaign defaults otherwise.</span>
      </div>
    </div>
  );
}
