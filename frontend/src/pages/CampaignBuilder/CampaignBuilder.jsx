import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import { BackLink, Button, Card, Page } from '../../components/ui';
import PageLoader from '../../components/PageLoader';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import StartChooser from './StartChooser';
import ScriptStep from './ScriptStep';
import PeopleStep from './PeopleStep';
import StartStep from './StartStep';
import { syncContacts } from './contactsSync';
import {
  emptyPayload, formatIST, formatRupees, fromCampaign, fromTemplate, getReadiness,
  newItem, normalizeItems, plural, toSavePayload,
} from './campaignModel';

// Creating a campaign, from scratch.
//
// Two steps — the call itself, then who to call — instead of the five
// screens (and later four accordion sections) this replaced. A new campaign
// opens on a choice rather than a form: describe it and have the script
// written, take a complete template, or start blank. Scoring, branching,
// weights and extraction all still exist, folded under each question's
// Options, so the common path never sees them. Readiness is computed
// continuously and every launch blocker names the step that fixes it.

// People come first so their columns exist as {{variables}} while the call
// is written; starting still needs at least one person.
const STEPS = [
  { key: 'people', label: "Who you're calling" },
  { key: 'script', label: 'Write the call' },
  { key: 'start', label: 'Review & start' },
];

function Stepper({ step, onChange, done }) {
  return (
    <nav aria-label="Campaign steps">
      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const active = s.key === step;
          return (
            <li key={s.key} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden="true" className="w-6 sm:w-10 h-px bg-border" />}
              <button
                type="button"
                onClick={() => onChange(s.key)}
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors
                  outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500/30
                  ${active ? 'bg-card dark:bg-muted shadow-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <span
                  className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold
                    ${done[s.key]
                      ? 'bg-positive/10 text-positive-dim dark:text-positive'
                      : active ? 'bg-brand-500 text-white' : 'bg-paper-400 dark:bg-white/10 text-muted-foreground'}`}
                >
                  {done[s.key] ? <span className="material-symbols-outlined [--icon-size:15px]">check</span> : i + 1}
                </span>
                {s.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default function CampaignBuilder() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { addToast } = useToast();
  const confirm = useConfirm();

  const [payload, setPayload] = useState(emptyPayload);
  const [loading, setLoading] = useState(isEdit);
  const [started, setStarted] = useState(isEdit);
  const [step, setStep] = useState(isEdit ? 'script' : 'people');
  // People sync apart from the script, and only when they (or the variables
  // their values are parsed by) changed since the last save.
  const [peopleDirty, setPeopleDirty] = useState(false);
  // A new campaign gets its id on first save; later saves update it.
  const [savedId, setSavedId] = useState(id || null);
  const [saving, setSaving] = useState(null); // 'draft' | 'launch'
  const [draftNotes, setDraftNotes] = useState(null);
  const [touched, setTouched] = useState(false);
  // Inline problems on script lines appear once someone has moved on from
  // the script (or is editing a saved one) — never on a line just added.
  const [showErrors, setShowErrors] = useState(isEdit);
  const topRef = useRef(null);
  // The app scrolls an inner panel rather than the window, so reset
  // whichever ancestor is actually scrolled.
  const scrollToTop = () => {
    for (let el = topRef.current?.parentElement; el; el = el.parentElement) {
      if (el.scrollTop > 0) el.scrollTo?.({ top: 0 });
    }
  };

  useEffect(() => {
    if (!id) return;
    let live = true;
    api.get(`/api/campaigns/${id}`)
      .then(({ data }) => { if (live) setPayload(fromCampaign(data)); })
      .catch(() => addToast('Could not load this campaign.', 'error'))
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Leaving with unsaved work asks first.
  useEffect(() => {
    if (!touched || saving) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [touched, saving]);

  const update = (patch) => {
    setPayload(p => ({ ...p, ...patch }));
    setTouched(true);
    if ('contacts' in patch || 'variables' in patch) setPeopleDirty(true);
  };

  // ── Starting points ───────────────────────────────────────────────────
  // A template is a type string, a drafted script is a payload, null is
  // blank. Whichever it is, contacts and timing already chosen survive.
  const start = (from, notes = []) => {
    setPayload(p => {
      // Who's being called — and their columns — survive picking a starting point.
      const keep = { contacts: p.contacts, variables: p.variables, scheduledAt: p.scheduledAt, ...(p.name ? { name: p.name } : {}) };
      if (from === null) {
        return { ...emptyPayload(), ...keep, dataToCollect: normalizeItems([newItem('question')]) };
      }
      if (typeof from === 'string') return { ...emptyPayload(), ...fromTemplate(from), ...keep };
      return {
        ...emptyPayload(),
        ...from,
        callSettings: { ...emptyPayload().callSettings, ...(from.callSettings || {}) },
        dataToCollect: normalizeItems(from.dataToCollect || []),
        ...keep,
      };
    });
    setDraftNotes(notes.length ? notes : null);
    setStarted(true);
    setStep('script');
    setTouched(true);
    scrollToTop();
  };

  const startOver = async () => {
    const ok = await confirm({
      title: 'Start the script over?',
      body: payload.mode === 'conversation'
        ? 'Your brief and lines will be replaced. People you have added, and their columns, stay.'
        : 'Your questions and lines will be replaced. People you have added, and their columns, stay.',
      confirmLabel: 'Start over',
      tone: 'danger',
    });
    if (ok) { setStarted(false); setDraftNotes(null); setStep('script'); }
  };

  // ── Readiness ─────────────────────────────────────────────────────────
  const readiness = useMemo(() => getReadiness(payload), [payload]);
  const scriptBlockers = readiness.blockers.filter(b => b.step === 'script');
  const peopleBlockers = readiness.blockers.filter(b => b.step === 'people');
  const startBlockers = readiness.blockers.filter(b => b.step === 'start');
  // Where each script problem shows inline. Unfilled [gaps] show at once —
  // they come from templates and are the first thing to fill in; everything
  // else waits for showErrors so a line you just added isn't already red.
  const issues = { items: {}, fields: {} };
  for (const b of scriptBlockers) {
    if (!b.gap && !showErrors) continue;
    if (b.itemId && !issues.items[b.itemId]) issues.items[b.itemId] = b;
    if (b.field && !issues.fields[b.field]) issues.fields[b.field] = b;
  }
  const done = {
    people: readiness.contacts > 0 && peopleBlockers.length === 0,
    script: started && scriptBlockers.length === 0,
    start: readiness.blockers.length === 0 && startBlockers.length === 0,
  };

  const goTo = (next) => {
    if (step === 'script' && next !== 'script' && started) setShowErrors(true);
    setStep(next);
    scrollToTop();
  };

  // ── Saving ────────────────────────────────────────────────────────────
  // The script (texts stored with {{variableId}}) through the wizard
  // endpoints, then — if they changed — the people, in chunks.
  const persist = async () => {
    const body = toSavePayload(payload);
    let campaignId = savedId;
    if (campaignId) {
      await api.put(`/api/campaigns/wizard/${campaignId}`, body);
    } else {
      const { data } = await api.post('/api/campaigns/wizard', body);
      campaignId = data.campaign.id;
      setSavedId(campaignId);
    }
    if (peopleDirty || !savedId) {
      const result = await syncContacts(api, campaignId, payload.contacts || []);
      setPeopleDirty(false);
      if (result.skippedRows.length) addToast(`${plural(result.skippedRows.length, 'row')} not saved — each needs a name and a valid number.`, 'warning');
    }
    return campaignId;
  };

  const saveDraft = async () => {
    setSaving('draft');
    try {
      const campaignId = await persist();
      setTouched(false);
      addToast('Saved. Nobody will be called until you start it.', 'success');
      if (!isEdit) navigate(`/edit-campaign/${campaignId}`, { replace: true });
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not save this campaign.', 'error');
    } finally {
      setSaving(null);
    }
  };

  const scheduled = !!payload.scheduledAt;

  const launch = async () => {
    if (readiness.blockers.length) return;
    setSaving('launch');
    try {
      const campaignId = await persist();
      setTouched(false);
      // A scheduled campaign queues its own delayed calls when saved —
      // starting it now as well would dial everyone immediately.
      if (scheduled) {
        addToast(`Scheduled for ${formatIST(payload.scheduledAt)} IST.`, 'success');
      } else {
        await api.post(`/api/campaigns/${campaignId}/status`, { action: 'start' });
        addToast(`Started — calling ${plural(readiness.contacts, 'person', 'people')}.`, 'success');
      }
      navigate(`/campaigns/${campaignId}`);
    } catch (err) {
      addToast(err.response?.data?.error || 'Could not start this campaign.', 'error');
      setSaving(null);
    }
  };

  if (loading) return <PageLoader text="Loading campaign…" />;

  const firstBlocker = readiness.blockers[0];
  const launchLabel = scheduled
    ? `Schedule ${plural(readiness.contacts, 'call')}`
    : readiness.contacts ? `Start calling ${plural(readiness.contacts, 'person', 'people')}` : 'Start calling';

  return (
    <Page>
      <div ref={topRef} />
      <BackLink to={isEdit ? `/campaigns/${id}` : '/'} className="mb-4">
        {isEdit ? 'Back to campaign' : 'Back to dashboard'}
      </BackLink>

      {
        <>
          {/* Sticky so the name/step controls stay in reach while a long
              contact list or script scrolls beneath them, instead of
              scrolling away with the rest of the page. */}
          <div className="sticky top-0 z-10 pt-5 pb-4 mb-3 bg-paper-300 dark:bg-ink-50 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0 flex-1">
              <label htmlFor="campaign-name" className="block text-xs font-medium text-muted-foreground">
                {isEdit ? 'Editing campaign' : 'New campaign'}
              </label>
              {/* A hidden copy of the text sizes the field, so the pencil
                  sits right after the name however long it is. */}
              <div className="group relative mt-0.5 inline-grid max-w-full align-top">
                <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-pre overflow-hidden text-2xl font-semibold tracking-tight px-2 pr-9 py-0.5 border border-transparent">
                  {payload.name || 'Name this campaign'}
                </span>
                <input
                  id="campaign-name"
                  aria-label="Campaign name"
                  size={1}
                  value={payload.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Name this campaign"
                  className="col-start-1 row-start-1 w-full min-w-0 bg-transparent text-2xl font-semibold tracking-tight text-foreground placeholder:text-muted-foreground/70
                             rounded-control -mx-2 px-2 py-0.5 pr-9 outline-none border border-transparent
                             hover:border-border focus:border-brand-450 focus:ring-[3px] focus:ring-brand-500/20 transition-[border-color,box-shadow]"
                />
                <span aria-hidden="true" className="material-symbols-outlined pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 [--icon-size:18px] text-muted-foreground opacity-60 group-hover:opacity-100">
                  edit
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!isEdit && started && (
                <Button variant="ghost" size="sm" icon="restart_alt" onClick={startOver} aria-label="Start over">
                  <span className="hidden sm:inline">Start over</span>
                </Button>
              )}
              <Stepper step={step} onChange={goTo} done={done} />
            </div>
          </div>

          {step === 'people' && (
            <PeopleStep payload={payload} update={update} onError={(msg) => addToast(msg, 'error')} />
          )}
          {step === 'script' && (started ? (
            <ScriptStep
              payload={payload}
              update={update}
              issues={issues}
              draftNotes={draftNotes}
              onDismissNotes={() => setDraftNotes(null)}
            />
          ) : (
            <div className="max-w-5xl pb-10">
              <StartChooser onStart={start} />
            </div>
          ))}
          {step === 'start' && (
            <StartStep payload={payload} update={update} readiness={readiness} />
          )}

          {/* Always in reach: what's left to do, and the way forward. */}
          <div className="sticky bottom-0 z-10 mt-5 -mb-10 pb-5 pt-2 bg-paper-300 dark:bg-ink-50">
            <Card className="shadow-overlay !py-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
                <div className="flex-1 min-w-0 text-[13px]" aria-live="polite">
                  {firstBlocker ? (
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <span className="material-symbols-outlined [--icon-size:16px] text-caution-dim dark:text-caution shrink-0">error</span>
                      <span className="truncate">
                        {firstBlocker.text}
                        {readiness.blockers.length > 1 && <span className="text-muted-foreground"> · {readiness.blockers.length - 1} more to fix</span>}
                      </span>
                      {firstBlocker.step !== step && (
                        <Button variant="link" size="sm" onClick={() => goTo(firstBlocker.step)} className="shrink-0">Fix</Button>
                      )}
                    </p>
                  ) : (
                    <p className="flex items-center gap-2 text-foreground">
                      <span className="material-symbols-outlined [--icon-size:16px] text-positive shrink-0">check_circle</span>
                      <span className="truncate">
                        Ready — {plural(readiness.contacts, 'person', 'people')}, {payload.mode === 'conversation' ? 'conversation calls' : plural(readiness.questions, 'question')}, at most {formatRupees(readiness.estCost)}
                      </span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {step !== 'people' && (
                    <Button variant="ghost" icon="arrow_back" onClick={() => goTo(step === 'start' ? 'script' : 'people')} disabled={!!saving}>Back</Button>
                  )}
                  <Button variant="secondary" onClick={saveDraft} loading={saving === 'draft'} disabled={!!saving}>
                    {isEdit ? 'Save' : 'Save draft'}
                  </Button>
                  {step === 'people' ? (
                    <Button iconRight="arrow_forward" onClick={() => goTo('script')}>Next: write the call</Button>
                  ) : step === 'script' ? (
                    <Button iconRight="arrow_forward" onClick={() => goTo('start')} disabled={!started}>Next: review & start</Button>
                  ) : (
                    <Button
                      icon={scheduled ? 'schedule' : 'call'}
                      onClick={launch}
                      loading={saving === 'launch'}
                      disabled={!!saving || readiness.blockers.length > 0}
                    >
                      {launchLabel}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </>
      }
    </Page>
  );
}
