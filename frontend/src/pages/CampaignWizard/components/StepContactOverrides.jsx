import React, { useState, useRef } from 'react';
import {
  PhoneIncoming, MessageSquare, X,
  CheckCircle, AlertCircle, PhoneOff,
  User, Plus
} from 'lucide-react';
import QuestionCard, { emptyItem } from './QuestionCard';

// ── Helpers ──────────────────────────────────────────────────────────────────
function wordCount(t) { return t?.trim().split(/\s+/).filter(Boolean).length || 0; }

function WordLimitTextarea({ value, onChange, limit, placeholder, rows = 2 }) {
  const count = wordCount(value);
  const over  = count > limit;
  return (
    <div className="flex flex-col gap-0.5 w-full">
      <textarea rows={rows} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y
          ${over ? 'border-destructive' : 'border-input'}`} />
      <span className={`text-xs text-right tabular-nums ${over ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>{count}/{limit} words</span>
    </div>
  );
}

// ── Call Design Modal ─────────────────────────────────────────────────────────
function CallDesignModal({ contact, campaignGoals, onSave, onClose }) {
  const current = contact.overrides?.goals ?? { ...campaignGoals };
  const [local, setLocal] = useState({ ...current });
  const set = (k, v) => setLocal(p => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
          <div>
            <h4 className="font-semibold text-base">Customize Call Design</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Overrides for <span className="font-medium text-foreground">{contact.name}</span> only</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-accent transition-colors"><X size={16} /></button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><MessageSquare size={12}/> Campaign Goal <span className="font-normal">(max 100 words)</span></label>
            <WordLimitTextarea value={local.goal} onChange={v => set('goal', v)} limit={100} placeholder="Override the campaign goal for this contact…" rows={2} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><PhoneIncoming size={12}/> Call Introduction <span className="font-normal">(max 300 words)</span></label>
            <WordLimitTextarea value={local.callIntro} onChange={v => set('callIntro', v)} limit={300} placeholder="Custom opening script for this contact…" rows={3} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><PhoneOff size={12}/> Call Sign-off <span className="font-normal">(max 300 words)</span></label>
            <WordLimitTextarea value={local.callSignOff} onChange={v => set('callSignOff', v)} limit={300} placeholder="Custom closing script for this contact…" rows={3} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
            <div>
              <p className="text-xs font-semibold">Courtesy Close</p>
              <p className="text-xs text-muted-foreground">Ask "Anything else?" before sign-off</p>
            </div>
            <button type="button" role="switch" aria-checked={local.courtesyClose}
              onClick={() => set('courtesyClose', !local.courtesyClose)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${local.courtesyClose ? 'bg-primary' : 'bg-input'}`}>
              <span className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${local.courtesyClose ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border sticky bottom-0 bg-background">
          <button onClick={onClose} className="inline-flex items-center h-9 px-4 rounded-md border border-input text-sm hover:bg-accent transition-colors">Cancel</button>
          <button onClick={() => { onSave({ goals: local }); onClose(); }}
            className="inline-flex items-center h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors">Save Overrides</button>
        </div>
      </div>
    </div>
  );
}

// ── Setup Questions Modal ─────────────────────────────────────────────────────
function QuestionsModal({ contact, campaignQuestions, onSave, onClose }) {
  const base = contact.overrides?.dataToCollect ?? campaignQuestions.map(q => ({ ...q }));
  const [local, setLocal] = useState(base.map(q => ({ ...q })));
  
  const dragFrom = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const addItem = () => {
    const next = [...local, emptyItem(local.length + 1)];
    setLocal(next);
  };

  const update = (id, updated) => {
    setLocal(prev => prev.map(q => q.id === id ? updated : q));
  };

  const remove = (id) => {
    const filtered = local.filter(i => i.id !== id).map((i, idx) => ({ ...i, order: idx + 1 }));
    setLocal(filtered);
  };

  // Drag-and-drop handlers
  const handleDragStart = (idx) => { dragFrom.current = idx; };
  const handleDragOver  = (idx) => { setDragOver(idx); };
  const handleDrop      = (toIdx) => {
    const from = dragFrom.current;
    if (from === null || from === toIdx) { dragFrom.current = null; setDragOver(null); return; }
    const next = [...local];
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

    setLocal(validated.map((i, idx) => ({ ...i, order: idx + 1 })));
    dragFrom.current = null;
    setDragOver(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-background z-10">
          <div>
            <h4 className="font-semibold text-base">Customize Setup Questions</h4>
            <p className="text-xs text-muted-foreground mt-0.5">Overrides for <span className="font-medium text-foreground">{contact.name}</span> only</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-accent transition-colors"><X size={16} /></button>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {local.length === 0 && (
               <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-border rounded-xl text-muted-foreground bg-muted/10">
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
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border h-10 w-full text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-all mt-2"
          >
            <Plus size={14} /> Add Question / Information
          </button>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border sticky bottom-0 bg-background">
          <button onClick={onClose} className="inline-flex items-center h-9 px-4 rounded-md border border-input text-sm hover:bg-accent transition-colors">Cancel</button>
          <button onClick={() => { onSave({ dataToCollect: local }); onClose(); }}
            className="inline-flex items-center h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors">Save Overrides</button>
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
      <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors group">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
            {contact.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="text-sm font-medium">{contact.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{contact.phone}</p>
          </div>
          <div className="flex gap-1 ml-2">
            {hasDesignOverride    && <span className="text-xs px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700">Design ✓</span>}
            {hasQuestionsOverride && <span className="text-xs px-2 py-0.5 rounded-full border border-purple-200 bg-purple-50 text-purple-700">Questions ✓</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setModal('questions')}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
            <MessageSquare size={12} /> Setup Questions
          </button>
          <button onClick={() => setModal('design')}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-input text-xs font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
            <PhoneIncoming size={12} /> Call Design
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
  const contacts         = payload.contacts         || [];
  const campaignGoals    = payload.goals            || {};
  const campaignQuestions = payload.dataToCollect   || [];

  const saveOverride = (index, patch) => {
    const updated = contacts.map((c, i) =>
      i === index
        ? { ...c, overrides: { ...(c.overrides || {}), ...patch } }
        : c
    );
    updatePayload({ contacts: updated });
  };

  const overrideCount = contacts.filter(c => c.overrides?.goals || c.overrides?.dataToCollect).length;

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight">Contact Customization</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Override the campaign defaults for any individual contact. Other contacts are unaffected.
        </p>
      </div>

      {overrideCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300 text-sm font-medium">
          <CheckCircle size={15} />
          {overrideCount} contact{overrideCount > 1 ? 's have' : ' has'} custom overrides
        </div>
      )}

      {contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 border-2 border-dashed border-border rounded-xl text-muted-foreground bg-muted/10">
          <User size={32} className="mb-2 opacity-40" />
          <p className="text-sm">No contacts uploaded yet. Go back to Step 3 to add contacts.</p>
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

      <div className="flex items-start gap-2 p-3 rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground">
        <AlertCircle size={13} className="mt-0.5 shrink-0" />
        <span>Overrides are saved locally in the wizard. When the campaign is launched, each contact's call will use its custom settings if set, falling back to campaign defaults otherwise.</span>
      </div>
    </div>
  );
}
