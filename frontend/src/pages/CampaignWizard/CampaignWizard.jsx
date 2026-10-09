import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { Button, Card, Alert, Badge } from '../../components/ui';
import Step1Basics from './components/Step1Basics';
import Step5Contacts from './components/Step5Contacts';
import Step3DataToCollect from './components/Step3DataToCollect';
import StepContactOverrides from './components/StepContactOverrides';
import BriefPanel from './components/BriefPanel';
import { useToast } from '../../context/ToastContext';
import PageLoader from '../../components/PageLoader';

import './CampaignWizard.css';

// One page, four sections.
//
// This was a five-step wizard: Basics → Contacts → Setup Questions →
// Overrides → Final Review, with Next between each. Two of those steps
// earned their place only by existing — Overrides sat in the required path
// for everyone including the majority who never use it, and Final Review
// existed to show you what you had typed on the four screens before it.
// Collapsed sections do that job continuously instead, and the bar at the
// bottom carries readiness and cost.
//
// The other half of the change is at the end: creating a campaign used to
// leave it sitting in draft with no way to run it (POST /status was only
// ever wired into the SUPER_ADMIN admin panel), so "Create & start calling"
// now does both.

const initialPayload = {
  name: '',
  type: '',
  prompt: '',
  goals: { goal: '', callIntro: '', callSignOff: '' },
  dataToCollect: [],
  endCallIf: '',
  rules: { successScore: 50, list: [], fieldsToExtract: [], scoringRules: [] },
  callSettings: {
    tone: 'Professional',
    language: 'English',
    voice: 'marin',
    maxDuration: 5,
    retryAttempts: 2,
  },
  contacts: [],
  // null = create it now; an ISO string = fire automatically at that instant.
  scheduledAt: null,
};

const CONDITIONS_REQUIRING_VALUE = new Set([
  'contains', 'does not contain', 'equals', 'starts with', 'ends with',
  'is greater than', 'is less than',
]);

const RATE_PER_MINUTE = 5; // ₹/min, matches api-service/src/config/billing.js

/** Collapsible section. Closed, it still reports what is inside it. */
function Section({ id, index, label, summary, complete, open, onToggle, children }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        // Name the control by its label alone and carry the summary as a
        // description. Folding the summary into the name would announce
        // "Contacts 48 contacts · about 240 min · ₹1,200" as the button's
        // name on every focus, and makes two sections ambiguous once the
        // overrides summary also counts contacts.
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-summary`}
        className="w-full flex items-center gap-3.5 p-5 text-left cursor-pointer
                   hover:bg-paper-200 dark:hover:bg-white/[0.03] transition-colors
                   outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30"
      >
        <span
          className={`shrink-0 size-6 rounded-field grid place-items-center text-xs font-semibold
            ${complete
              ? 'bg-positive/10 text-positive-dim dark:text-positive'
              : 'bg-paper-400 dark:bg-white/10 text-muted-foreground'}`}
        >
          {/* Only glyphs present in index.html's Material Symbols subset
              render; anything outside it appears as its own literal name.
              An incomplete section shows its position instead. */}
          {complete
            ? <span className="material-symbols-outlined [--icon-size:15px]">check</span>
            : index}
        </span>
        <span className="flex-1 min-w-0">
          <span id={`${id}-label`} className="block text-sm font-semibold text-foreground">{label}</span>
          <span id={`${id}-summary`} className="block text-xs text-muted-foreground mt-0.5 truncate">{summary}</span>
        </span>
        <span
          className={`material-symbols-outlined [--icon-size:20px] text-muted-foreground
            transition-transform ${open ? 'rotate-180' : ''}`}
        >
          expand_more
        </span>
      </button>
      {open && (
        <div id={`${id}-body`} className="border-t border-border p-5">
          {children}
        </div>
      )}
    </Card>
  );
}

export default function CampaignWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [payload, setPayload] = useState(initialPayload);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(null); // 'draft' | 'launch'
  // Editing an existing campaign opens on the questions, which is what
  // people come back to change. A new one opens on the brief.
  const [open, setOpen] = useState(id ? 'questions' : 'basics');

  useEffect(() => { if (id) fetchCampaign(); }, [id]);

  const fetchCampaign = async () => {
    try {
      const res = await api.get(`/api/campaigns/${id}`);
      const c = res.data;
      setPayload({
        ...initialPayload,
        name: c.name || '',
        type: c.type || '',
        endCallIf: c.endCallIf || '',
        dataToCollect: (c.dataToCollect || []).map(q => ({
          ...q,
          isWeightManuallySet: q.isWeightManuallySet ?? true,
        })),
        rules: c.rules || initialPayload.rules,
        callSettings: c.callSettings || initialPayload.callSettings,
        goals: {
          goal: c.callModule?.goal || '',
          callIntro: c.callModule?.callIntro || '',
          callSignOff: c.callModule?.callSignOff || '',
        },
        contacts: (c.campaignContacts || []).map(cc => ({
          name: cc.overrides?.name || cc.contact?.name || '',
          phone: cc.contact?.phone || '',
          overrides: cc.overrides || {},
        })),
        scheduledAt: c.scheduledAt || null,
      });
    } catch (err) {
      console.error(err);
      addToast('Could not load this campaign.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updatePayload = (data) => setPayload(p => ({ ...p, ...data }));

  // A drafted campaign replaces the configuration but never the contacts —
  // re-drafting after an import must not throw away an uploaded list.
  const applyDraft = (drafted) => {
    setPayload(p => ({ ...p, ...drafted, contacts: p.contacts, scheduledAt: p.scheduledAt }));
    setOpen('questions');
  };

  // ── Readiness ────────────────────────────────────────────────────────
  // Every check the old Review step performed, evaluated continuously and
  // shown in the bar rather than on a screen of its own.
  const checks = useMemo(() => {
    const items = payload.dataToCollect || [];
    const questions = items.filter(i => (i.itemType || 'question') === 'question');

    const totalWeight = items.reduce((sum, i) => {
      if ((i.itemType || 'question') !== 'question') return sum;
      const subs = i.fieldsToExtract || [];
      if (subs.length) return sum + subs.reduce((s, sf) => s + (sf.weight || 0), 0);
      return sum + (i.weight || 0);
    }, 0);

    const emptyQuestions = questions.filter(q => !q.text?.trim()).length;

    const incompleteScoring = questions.filter(q => {
      if (q.scoringActiveTab === 'semantic') return !q.scoringCriteria?.trim();
      const condition = q.expectedAnswer?.condition;
      if (!condition || !CONDITIONS_REQUIRING_VALUE.has(condition)) return false;
      return !q.expectedAnswer?.value?.toString().trim();
    }).length;

    const contacts = payload.contacts?.length || 0;
    const perCallMinutes = payload.callSettings?.maxDuration || 5;
    const estMinutes = contacts * perCallMinutes;

    // Blocking problems only. A weight total under 100 is legal — the score
    // is simply out of less — so it is a warning, not a gate.
    const blockers = [];
    if (!payload.name?.trim()) blockers.push('Give the campaign a name.');
    if (!questions.length) blockers.push('Add at least one question.');
    if (emptyQuestions) blockers.push(`${emptyQuestions} question${emptyQuestions === 1 ? ' has' : 's have'} no text.`);
    if (incompleteScoring) blockers.push(`${incompleteScoring} scoring rule${incompleteScoring === 1 ? ' is' : 's are'} missing a value.`);
    if (totalWeight > 100) blockers.push(`Weights total ${totalWeight}% — the maximum is 100%.`);

    const warnings = [];
    if (questions.length && totalWeight < 100) {
      warnings.push(`Weights total ${totalWeight}%, so a perfect call scores ${totalWeight}.`);
    }
    if (!contacts) warnings.push('No contacts yet — you can add them later, but nothing will dial.');

    return { questions, totalWeight, contacts, estMinutes, estCost: estMinutes * RATE_PER_MINUTE, blockers, warnings };
  }, [payload]);

  const sections = {
    basics: {
      label: 'Campaign & script',
      complete: !!payload.name?.trim() && !!payload.type,
      summary: payload.name?.trim()
        ? [payload.name, payload.type, payload.callSettings?.language,
           `${payload.callSettings?.maxDuration || 5} min cap`].filter(Boolean).join(' · ')
        : 'Name, type, voice, and what the agent says',
    },
    questions: {
      label: 'Questions & scoring',
      complete: checks.questions.length > 0 && !checks.blockers.some(b => b.includes('question') || b.includes('scoring')),
      summary: checks.questions.length
        ? `${checks.questions.length} question${checks.questions.length === 1 ? '' : 's'} · ${checks.totalWeight}% weight allocated`
        : 'What the agent asks, and how answers are scored',
    },
    contacts: {
      label: 'Contacts',
      complete: checks.contacts > 0,
      summary: checks.contacts
        ? `${checks.contacts} contact${checks.contacts === 1 ? '' : 's'} · about ${checks.estMinutes} min · ₹${checks.estCost.toLocaleString('en-IN')}`
        : 'Who gets called',
    },
    overrides: {
      label: 'Per-contact overrides',
      complete: true, // genuinely optional — never blocks
      summary: (() => {
        const n = (payload.contacts || []).filter(c => Object.keys(c.overrides || {}).some(k => k !== 'name')).length;
        return n ? `${n} contact${n === 1 ? '' : 's'} personalised` : 'Optional — personalise the script per contact';
      })(),
    },
  };

  const toggle = (key) => setOpen(o => (o === key ? null : key));

  // ── Saving ───────────────────────────────────────────────────────────
  const persist = async () => {
    if (id) {
      await api.put(`/api/campaigns/wizard/${id}`, payload);
      return id;
    }
    const res = await api.post('/api/campaigns/wizard', payload);
    return res.data.campaign.id;
  };

  const saveDraft = async () => {
    setSaving('draft');
    try {
      const campaignId = await persist();
      addToast('Saved. Nothing is dialling yet.', 'success');
      if (!id) navigate(`/edit-campaign/${campaignId}`, { replace: true });
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not save this campaign.', 'error');
    } finally {
      setSaving(null);
    }
  };

  const scheduled = !!payload.scheduledAt;

  const createAndStart = async () => {
    if (checks.blockers.length) {
      addToast(checks.blockers[0], 'error');
      return;
    }
    setSaving('launch');
    try {
      const campaignId = await persist();

      // A scheduled campaign already enqueues its own delayed jobs at save
      // time — starting it now would dial everyone immediately, which is
      // the opposite of what scheduling asked for.
      if (!scheduled) {
        await api.post(`/api/campaigns/${campaignId}/status`, { action: 'start' });
        addToast(`Campaign started — ${checks.contacts} call${checks.contacts === 1 ? '' : 's'} queued.`, 'success');
      } else {
        const when = new Date(payload.scheduledAt).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short',
        });
        addToast(`Scheduled for ${when} IST.`, 'success');
      }
      navigate(`/campaigns/${campaignId}`);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not start this campaign.', 'error');
      setSaving(null);
    }
  };

  if (loading) return <PageLoader text="Loading campaign…" />;

  return (
    <div className="bg-paper-300 dark:bg-ink-50 min-h-full">
      <div className="page-gutter pt-5 pb-7 animate-fade-in max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {id ? 'Edit campaign' : 'New campaign'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {id
              ? 'Changes apply to calls that have not been placed yet.'
              : 'Describe it in a sentence, or fill in the sections yourself.'}
          </p>
        </div>

        {/* Drafting leads for a new campaign; on an existing one it would
            overwrite work already done, so it is not offered. */}
        {!id && (
          <Card className="mb-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Start from a description</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Questions, weights, branching and the sign-off, drafted for you to correct.
                </p>
              </div>
              <Badge tone="brand" dot={false}>Optional</Badge>
            </div>
            <BriefPanel onDraft={applyDraft} disabled={!!saving} />
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {Object.entries(sections).map(([key, s], i) => (
            <Section
              key={key}
              id={key}
              index={i + 1}
              label={s.label}
              summary={s.summary}
              complete={s.complete}
              open={open === key}
              onToggle={() => toggle(key)}
            >
              {key === 'basics' && <Step1Basics payload={payload} updatePayload={updatePayload} />}
              {key === 'questions' && <Step3DataToCollect payload={payload} updatePayload={updatePayload} />}
              {key === 'contacts' && <Step5Contacts payload={payload} updatePayload={updatePayload} />}
              {key === 'overrides' && <StepContactOverrides payload={payload} updatePayload={updatePayload} />}
            </Section>
          ))}
        </div>

        {/* The old Review step, as a bar that is always there. */}
        <div className="sticky bottom-0 mt-4 pb-1">
          <Card className="shadow-overlay">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                {checks.blockers.length === 0 && checks.warnings.length === 0 && (
                  <p className="text-[13px] text-muted-foreground flex items-center gap-2">
                    <span className="material-symbols-outlined [--icon-size:15px] text-positive">check_circle</span>
                    Ready — {checks.questions.length} question{checks.questions.length === 1 ? '' : 's'}, {checks.contacts} contact{checks.contacts === 1 ? '' : 's'}, about ₹{checks.estCost.toLocaleString('en-IN')}.
                  </p>
                )}
                {checks.blockers.map((b, i) => (
                  <p key={`b${i}`} className="text-[13px] text-negative-dim dark:text-negative flex items-center gap-2">
                    <span className="material-symbols-outlined [--icon-size:15px]">error</span>{b}
                  </p>
                ))}
                {checks.blockers.length === 0 && checks.warnings.map((w, i) => (
                  <p key={`w${i}`} className="text-[13px] text-caution-dim dark:text-caution flex items-center gap-2">
                    <span className="material-symbols-outlined [--icon-size:15px]">warning</span>{w}
                  </p>
                ))}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost"
                  onClick={saveDraft}
                  loading={saving === 'draft'}
                  disabled={!!saving}
                >
                  Save, don't call yet
                </Button>
                <Button
                  onClick={createAndStart}
                  loading={saving === 'launch'}
                  disabled={!!saving || checks.blockers.length > 0}
                  icon={scheduled ? 'pending_actions' : 'play_arrow'}
                >
                  {scheduled ? 'Create & schedule' : 'Create & start calling'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
