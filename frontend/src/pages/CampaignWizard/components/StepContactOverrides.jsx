import React, { useState, useRef } from 'react';
import { Button, IconButton } from '../../../components/ui';
import {
  PhoneIncoming, MessageSquare, X,
  CheckCircle, AlertCircle, PhoneOff,
  User, Plus
} from 'lucide-react';
import QuestionCard from './QuestionCard';
import { emptyItem } from './questionModel';
import { useToast } from '../../../context/ToastContext';

function wordCount(t) { return t?.trim().split(/\s+/).filter(Boolean).length || 0; }

function WordLimitTextarea({ value, onChange, limit, placeholder, rows = 2 }) {
  const count = wordCount(value);
  const over  = count > limit;
  return (
    <div className="flex flex-col gap-0.5 w-full">
      <textarea rows={rows} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full rounded-control border bg-paper-100 dark:bg-ink-300 px-3 py-2 text-sm text-ink-100 dark:text-paper-200 placeholder:text-ink-800 dark:placeholder:text-ink-700 focus:outline-none focus:ring-2 resize-y transition-colors
          ${over
            ? 'border-negative focus:ring-negative/20'
            : 'border-paper-600 dark:border-ink-400 focus:border-brand-500 focus:ring-brand-500/20'
          }`} />
      <span className={`text-xs text-right tabular-nums ${over ? 'text-negative font-semibold' : 'text-ink-800'}`}>{count}/{limit} words</span>
    </div>
  );
}

// ── Call Design Modal ─────────────────────────────────────────────────────────
function CallDesignModal({ contact, campaignGoals, campaignMaxDuration, onSave, onClose }) {
  const current = contact.overrides?.goals ?? { ...campaignGoals };
  const [local, setLocal] = useState({ ...current });
  const [maxDurationMin, setMaxDurationMin] = useState(
    contact.overrides?.maxCallDurationSec ? Math.round(contact.overrides.maxCallDurationSec / 60) : ''
  );
  const set = (k, v) => setLocal(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card shadow-overlay w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-paper-500 dark:border-ink-400 sticky top-0 bg-paper-100 dark:bg-ink-200 z-10">
          <div>
            <h4 className="font-semibold text-sm text-ink-100 dark:text-paper-200">Customize Call Design</h4>
            <p className="text-xs font-medium text-ink-700 dark:text-ink-900 mt-0.5">Overrides for <span className="font-medium text-ink-100 dark:text-paper-200">{contact.name}</span> only</p>
          </div>
          <Button variant="ghost" size="md" onClick={onClose}><X size={16} /></Button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-600 dark:text-ink-900 flex items-center gap-1"><MessageSquare size={11} /> Campaign Goal <span className="font-normal text-ink-800 dark:text-ink-800">(max 100 words)</span></label>
            <WordLimitTextarea value={local.goal} onChange={v => set('goal', v)} limit={100} placeholder="Override the campaign goal for this contact…" rows={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-600 dark:text-ink-900 flex items-center gap-1"><PhoneIncoming size={11} /> Call Introduction <span className="font-normal text-ink-800 dark:text-ink-800">(max 300 words)</span></label>
            <WordLimitTextarea value={local.callIntro} onChange={v => set('callIntro', v)} limit={300} placeholder="Custom opening script for this contact…" rows={3} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-600 dark:text-ink-900 flex items-center gap-1"><PhoneOff size={11} /> Call Sign-off <span className="font-normal text-ink-800 dark:text-ink-800">(max 300 words)</span></label>
            <WordLimitTextarea value={local.callSignOff} onChange={v => set('callSignOff', v)} limit={300} placeholder="Custom closing script for this contact…" rows={3} />
          </div>

          {/* Per-contact max duration override */}
          <div className="flex flex-col gap-1.5 pt-4 border-t border-paper-400 dark:border-ink-400">
            <label className="text-xs font-medium text-ink-600 dark:text-ink-900">Max Call Duration (override)</label>
            <p className="text-xs font-medium text-ink-800">Leave blank to use campaign default ({campaignMaxDuration} min)</p>
            <div className="flex items-center gap-2">
              <input
                type="number" min="1" max="60"
                value={maxDurationMin}
                onChange={e => setMaxDurationMin(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                placeholder={String(campaignMaxDuration)}
                className="h-9 w-24 rounded-control border border-paper-600 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              <span className="text-sm text-ink-700">minutes</span>
              {maxDurationMin !== '' && (
                <span className="text-xs font-medium text-ink-800">≈ ₹{parseInt(maxDurationMin) * 5} est. cost</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-paper-500 dark:border-ink-400 sticky bottom-0 bg-paper-100 dark:bg-ink-200">
          <Button variant="secondary" size="md" onClick={onClose} icon="close">Cancel</Button>
          <Button variant="primary" size="md" onClick={() => { const durSec = maxDurationMin !== '' ? parseInt(maxDurationMin) * 60 : undefined; onSave({ goals: local, ...(durSec ? { maxCallDurationSec: durSec } : { maxCallDurationSec: undefined }) }); onClose(); }}>Save Overrides</Button>
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
      <div className="bg-paper-100 dark:bg-ink-200 border border-paper-500 dark:border-ink-400 rounded-card shadow-overlay w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-paper-500 dark:border-ink-400 sticky top-0 bg-paper-100 dark:bg-ink-200 z-10">
          <div>
            <h4 className="font-semibold text-sm text-ink-100 dark:text-paper-200">Customize Setup Questions</h4>
            <p className="text-xs font-medium text-ink-700 dark:text-ink-900 mt-0.5">Overrides for <span className="font-medium text-ink-100 dark:text-paper-200">{contact.name}</span> only</p>
          </div>
          <Button variant="ghost" size="md" onClick={onClose}><X size={16} /></Button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {local.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-paper-500 dark:border-ink-400 rounded-card text-ink-800 dark:text-ink-800 bg-paper-200 dark:bg-ink-50">
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

          <Button variant="subtle" size="sm" type="button" onClick={addItem}>
            <Plus size={14} /> Add Question / Information
          </Button>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-paper-500 dark:border-ink-400 sticky bottom-0 bg-paper-100 dark:bg-ink-200">
          <Button variant="secondary" size="md" onClick={onClose} icon="close">Cancel</Button>
          <Button variant="primary" size="md" onClick={() => { onSave({ dataToCollect: local }); onClose(); }}>Save Overrides</Button>
        </div>
      </div>
    </div>
  );
}

// ── Contact Row ───────────────────────────────────────────────────────────────
function ContactRow({ contact, index, campaignGoals, campaignQuestions, campaignMaxDuration, onSave }) {
  const [modal, setModal] = useState(null);

  const hasDesignOverride    = !!contact.overrides?.goals;
  const hasQuestionsOverride = !!contact.overrides?.dataToCollect;

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 rounded-card border border-paper-500 dark:border-ink-400 bg-paper-100 dark:bg-ink-200 hover:border-brand-300 dark:hover:border-brand-500 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-600">
            {contact.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-100 dark:text-paper-200">{contact.name}</p>
            <p className="text-xs text-ink-700 dark:text-ink-900">{contact.phone}</p>
          </div>
          <div className="flex gap-1 ml-2">
            {hasDesignOverride    && <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-brand-200 bg-brand-100 text-brand-600">Design ✓</span>}
            {hasQuestionsOverride && <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-brand-200 bg-brand-100 text-brand-600">Questions ✓</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setModal('questions')}>
            <MessageSquare size={11} /> Setup Questions
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setModal('design')}>
            <PhoneIncoming size={11} /> Call Design
          </Button>
        </div>
      </div>

      {modal === 'design' && (
        <CallDesignModal contact={contact} campaignGoals={campaignGoals} campaignMaxDuration={campaignMaxDuration}
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
  const campaignMaxDuration = payload.callSettings?.maxDuration || 5;

  const saveOverride = (index, patch) => {
    const updated = contacts.map((c, i) =>
      i === index ? { ...c, overrides: { ...(c.overrides || {}), ...patch } } : c
    );
    updatePayload({ contacts: updated });
  };

  const overrideCount = contacts.filter(c => c.overrides?.goals || c.overrides?.dataToCollect).length;

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      {overrideCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-control border border-brand-300 bg-brand-100 text-brand-600 text-sm font-medium">
          <CheckCircle size={14} />
          {overrideCount} contact{overrideCount > 1 ? 's have' : ' has'} custom overrides
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 border-2 border-dashed border-paper-500 dark:border-ink-400 rounded-card text-ink-800 dark:text-ink-800 bg-paper-200 dark:bg-ink-50">
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
              campaignMaxDuration={campaignMaxDuration}
              onSave={saveOverride}
            />
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 p-3 rounded-control border border-paper-500 dark:border-ink-400 bg-paper-200 dark:bg-ink-50 text-xs font-medium text-ink-700 dark:text-ink-900">
        <AlertCircle size={12} className="mt-0.5 shrink-0 text-ink-800 dark:text-ink-800" />
        <span>Overrides are saved locally in the wizard. When the campaign is launched, each contact's call will use its custom settings if set, falling back to campaign defaults otherwise.</span>
      </div>
    </div>
  );
}
