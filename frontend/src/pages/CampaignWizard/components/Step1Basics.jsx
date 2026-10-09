import React, { useState, useRef } from 'react';
import { Lightbulb, PhoneIncoming, PhoneOff, Timer, Mic, Play, Square } from 'lucide-react';
import api from '../../../api/axios';
import { Button, IconButton, SelectableCard, Field, Input, WordLimitTextarea, WaveLoader } from '../../../components/ui';

// Gemini Live's full prebuilt voice set — all 30, per Google's docs (kept in
// sync manually with api-service/src/controllers/campaign.controller.js's
// GEMINI_VOICES). This is now the only voice picker in the wizard: every
// call runs on Gemini Live, so there's no separate OpenAI voice list to
// maintain here anymore.
const GEMINI_VOICES = [
  { value: 'Kore', label: 'Kore', desc: 'Firm', recommended: true },
  { value: 'Zephyr', label: 'Zephyr', desc: 'Bright' },
  { value: 'Orus', label: 'Orus', desc: 'Firm' },
  { value: 'Autonoe', label: 'Autonoe', desc: 'Bright' },
  { value: 'Umbriel', label: 'Umbriel', desc: 'Easy-going' },
  { value: 'Erinome', label: 'Erinome', desc: 'Clear' },
  { value: 'Laomedeia', label: 'Laomedeia', desc: 'Upbeat' },
  { value: 'Schedar', label: 'Schedar', desc: 'Even' },
  { value: 'Achird', label: 'Achird', desc: 'Friendly' },
  { value: 'Sadachbia', label: 'Sadachbia', desc: 'Lively' },
  { value: 'Puck', label: 'Puck', desc: 'Upbeat' },
  { value: 'Fenrir', label: 'Fenrir', desc: 'Excitable' },
  { value: 'Aoede', label: 'Aoede', desc: 'Breezy' },
  { value: 'Enceladus', label: 'Enceladus', desc: 'Breathy' },
  { value: 'Algieba', label: 'Algieba', desc: 'Smooth' },
  { value: 'Algenib', label: 'Algenib', desc: 'Gravelly' },
  { value: 'Achernar', label: 'Achernar', desc: 'Soft' },
  { value: 'Gacrux', label: 'Gacrux', desc: 'Mature' },
  { value: 'Zubenelgenubi', label: 'Zubenelgenubi', desc: 'Casual' },
  { value: 'Sadaltager', label: 'Sadaltager', desc: 'Knowledgeable' },
  { value: 'Charon', label: 'Charon', desc: 'Informative' },
  { value: 'Leda', label: 'Leda', desc: 'Youthful' },
  { value: 'Callirrhoe', label: 'Callirrhoe', desc: 'Easy-going' },
  { value: 'Iapetus', label: 'Iapetus', desc: 'Clear' },
  { value: 'Despina', label: 'Despina', desc: 'Smooth' },
  { value: 'Rasalgethi', label: 'Rasalgethi', desc: 'Informative' },
  { value: 'Alnilam', label: 'Alnilam', desc: 'Firm' },
  { value: 'Pulcherrima', label: 'Pulcherrima', desc: 'Forward' },
  { value: 'Vindemiatrix', label: 'Vindemiatrix', desc: 'Gentle' },
  { value: 'Sulafat', label: 'Sulafat', desc: 'Warm' },
];

const CAMPAIGN_TYPES = [
  { value: 'HR',            label: 'HR',           desc: 'Recruitment & talent outreach' },
  { value: 'RECRUITER',     label: 'Recruiter',     desc: 'Agency staffing calls' },
  { value: 'SALES',         label: 'Sales',         desc: 'Lead gen & product demos' },
  { value: 'LOAN_RECOVERY', label: 'Loan Recovery', desc: 'EMI reminders & collections' },
  { value: 'FEEDBACK',      label: 'Feedback',      desc: 'CSAT & post-service surveys' },
];

const GOAL_SUGGESTIONS = {
  HR: ['Shortlist candidates', 'Schedule a screening call', 'Collect expected CTC and notice period'],
  RECRUITER: ['Qualify leads for open positions', 'Confirm consultant availability', 'Pitch a new placement opportunity'],
  SALES: ['Book a product demo', 'Upsell an annual subscription', 'Re-engage churned customers'],
  LOAN_RECOVERY: ['Remind about overdue EMI', 'Negotiate repayment schedule', 'Verify contact details'],
  FEEDBACK: ['Collect post-service CSAT', 'Identify reason for dissatisfaction', 'Measure NPS'],
};

const INTRO_SUGGESTIONS = {
  HR: 'Hi, this is an automated call from [Company] Talent Team. Am I speaking with [Name]?',
  RECRUITER: 'Hello [Name], this is [Agency] calling regarding an exciting opportunity. Do you have two minutes?',
  SALES: "Hi [Name], I'm reaching out from [Company]. We noticed you recently expressed interest in [Product].",
  LOAN_RECOVERY: 'Good [morning/afternoon] [Name], this is an automated reminder from [Lender].',
  FEEDBACK: "Hi [Name], this is a quick automated call from [Company] — we'd love to hear about your experience.",
};

const SIGNOFF_SUGGESTIONS = {
  HR: 'Thank you for your time today. Our team will be in touch shortly. Have a great day!',
  RECRUITER: "Thanks so much. We'll review and get back to you shortly. Goodbye!",
  SALES: "Wonderful — we'll send your demo invite shortly. Thanks for your time!",
  LOAN_RECOVERY: 'Thank you for your cooperation. Please ensure payment is made before the due date.',
  FEEDBACK: 'Thank you so much for your feedback — it genuinely helps us improve. Goodbye!',
};

function SuggestionPills({ items, onSelect }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-0.5">
      {items.map((s, i) => (
        <Button variant="subtle" size="sm" key={i} type="button" onClick={() => onSelect(s)}>
          <Lightbulb size={10} />
          {s.length > 50 ? s.slice(0, 47) + '…' : s}
        </Button>
      ))}
    </div>
  );
}

export default function Step1Basics({ payload, updatePayload }) {
  const type = payload.type || 'HR';

  const goalSuggestions   = GOAL_SUGGESTIONS[type]   || GOAL_SUGGESTIONS.HR;
  const introSuggestion   = INTRO_SUGGESTIONS[type]  || '';
  const signOffSuggestion = SIGNOFF_SUGGESTIONS[type] || '';

  const goals = payload.goals || {};
  const setGoal = (field, val) => updatePayload({ goals: { ...goals, [field]: val } });

  // Voice preview — plays a short sample via Gemini's cheap, synchronous TTS
  // endpoint (not the Live session live calls use) so users can compare
  // voices before picking one. previewingVoice tracks which button is
  // loading/playing so only one plays at a time. previewCacheRef caches the
  // generated audio per (voice, sample text) so replaying the same voice
  // reuses it instantly instead of calling the API again every time — only
  // invalidated if the campaign's own intro text (used as the sample) changes.
  const [previewingVoice, setPreviewingVoice] = useState(null); // 'loading' | 'playing' per voice value
  const audioRef = useRef(null);
  const previewCacheRef = useRef(new Map()); // cacheKey -> object URL

  const playVoicePreview = async (voice) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (previewingVoice?.voice === voice && previewingVoice?.state === 'playing') {
      setPreviewingVoice(null);
      return;
    }

    const sampleText = goals.callIntro?.trim() || undefined; // preview in the campaign's own words when set
    const cacheKey = `${voice}::${sampleText || '__default__'}`;
    const playFromUrl = (url) => {
      const audioEl = new Audio(url);
      audioRef.current = audioEl;
      setPreviewingVoice({ voice, state: 'playing' });
      audioEl.onended = () => setPreviewingVoice(null);
      audioEl.onerror = () => setPreviewingVoice(null);
      audioEl.play();
    };

    const cachedUrl = previewCacheRef.current.get(cacheKey);
    if (cachedUrl) {
      playFromUrl(cachedUrl);
      return;
    }

    setPreviewingVoice({ voice, state: 'loading' });
    try {
      const res = await api.post(
        '/api/campaigns/preview-voice-gemini',
        { voice, text: sampleText },
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(res.data);
      previewCacheRef.current.set(cacheKey, url);
      playFromUrl(url);
    } catch (e) {
      console.error('Voice preview failed:', e);
      setPreviewingVoice(null);
    }
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      {/* <div>
        <h3 className="text-2xl font-bold text-foreground tracking-tight">Campaign Basics</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Give your campaign a name, choose its type, and craft the words your AI agent will use.
        </p>
      </div> */}

      {/* Campaign name */}
      <Field label={<>Campaign Name <span className="text-negative">*</span></>}>
        <Input
          type="text"
          value={payload.name}
          onChange={e => updatePayload({ name: e.target.value })}
          placeholder="e.g. Q3 Software Engineer Hiring"
        />
      </Field>

      {/* Campaign type */}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-foreground">
          Campaign Type <span className="text-negative">*</span>
        </span>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
          {CAMPAIGN_TYPES.map(({ value, label, desc }) => (
            <SelectableCard
              key={value}
              compact
              selected={payload.type === value}
              onSelect={() => updatePayload({ type: value })}
            >
              <span className="block text-xs font-semibold text-foreground">{label}</span>
              <span className="block text-xs text-muted-foreground leading-snug mt-0.5">{desc}</span>
            </SelectableCard>
          ))}
        </div>
      </div>

      {/* Max Call Duration */}
      <div className="flex flex-col gap-1.5 mt-2 pt-6 border-t border-paper-400 dark:border-ink-400/50">
        <div className="flex items-center gap-1.5">
          <Timer size={13} className="text-brand-500" />
          <label htmlFor="max-call-duration" className="text-sm font-semibold text-foreground">
            Max Call Duration <span className="text-negative">*</span>
          </label>
        </div>
        <p className="text-xs font-medium text-muted-foreground -mt-0.5">
          The call will automatically end 4 seconds before this limit. Can be overridden per contact.
        </p>
        <div className="flex items-center gap-3 mt-1">
          <div className="w-32">
            <Input
              id="max-call-duration"
              type="number"
              min="1"
              max="60"
              value={payload.callSettings?.maxDuration ?? 5}
              onChange={e => {
                const v = Math.max(1, Math.min(60, parseInt(e.target.value) || 1));
                updatePayload({ callSettings: { ...(payload.callSettings || {}), maxDuration: v } });
              }}
            />
          </div>
          <span className="text-sm text-muted-foreground">minutes per call</span>
          {payload.callSettings?.maxDuration && (
            <span className="text-xs font-medium text-muted-foreground">
              ≈ ₹{payload.callSettings.maxDuration * 5} estimated per call
            </span>
          )}
        </div>
      </div>

      {/* Voice — Gemini Live's prebuilt voices, since every call now runs on
          Gemini Live (the earlier OpenAI voice picker is gone; it named
          voices that were never valid for the engine actually placing the
          calls). Stored as callSettings.geminiVoice, read directly by
          setupGeminiLive() in plivoStreamHandler.js. */}
      <div className="flex flex-col gap-2 mt-2 pt-6 border-t border-paper-400 dark:border-ink-400/50">
        <div className="flex items-center gap-1.5">
          <Mic size={13} className="text-brand-500" />
          <span className="text-sm font-semibold text-foreground">Voice</span>
        </div>
        <p className="text-xs font-medium text-muted-foreground -mt-0.5">
          Hit play to hear a sample before choosing — Kore is the default if none is picked.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 mt-1">
          {GEMINI_VOICES.map(({ value, label, desc, recommended }) => {
            const selected = (payload.callSettings?.geminiVoice || 'Kore') === value;
            const isThis = previewingVoice?.voice === value;
            return (
              <SelectableCard
                key={value}
                compact
                selected={selected}
                onSelect={() => updatePayload({ callSettings: { ...(payload.callSettings || {}), geminiVoice: value } })}
              >
                <span className="flex w-full items-center gap-2">
                <span className="flex min-w-0 flex-1 flex-col items-start">
                  <span className="truncate text-xs font-semibold text-foreground">{label}</span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {recommended ? 'Recommended · ' : ''}{desc}
                  </span>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Preview ${label}`}
                  onClick={(e) => { e.stopPropagation(); playVoicePreview(value); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); playVoicePreview(value); } }}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-muted-foreground hover:text-brand-500 hover:bg-brand-500/10 cursor-pointer"
                  title={`Preview ${label}`}
                >
                  {isThis && previewingVoice.state === 'loading' && <WaveLoader size={13} label="Loading preview" />}
                  {isThis && previewingVoice.state === 'playing' && <Square size={11} fill="currentColor" />}
                  {!isThis && <Play size={13} fill="currentColor" />}
                </span>
                </span>
              </SelectableCard>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-5 pt-4 border-t border-paper-400 dark:border-ink-400/50">
        {/* Campaign Goal */}
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Lightbulb size={13} className="text-brand-500" />
            <label htmlFor="basics-goal" className="text-sm font-semibold text-foreground">Primary Goal</label>
          </div>
          <WordLimitTextarea
            id="basics-goal"
            value={goals.goal} onChange={v => setGoal('goal', v)} limit={100}
            placeholder="Describe what the agent should achieve…"
            style={{ minHeight: '60px' }}
          />
          <SuggestionPills items={goalSuggestions} onSelect={v => setGoal('goal', v)} />
        </section>

        {/* Call Introduction */}
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <PhoneIncoming size={13} className="text-brand-500" />
            <label htmlFor="basics-intro" className="text-sm font-semibold text-foreground">Introduction</label>
          </div>
          <WordLimitTextarea
            id="basics-intro"
            value={goals.callIntro} onChange={v => setGoal('callIntro', v)} limit={300}
            placeholder="Hi, this is [Bot] calling from…"
            style={{ minHeight: '60px' }}
          />
          <SuggestionPills items={[introSuggestion]} onSelect={v => setGoal('callIntro', v)} />
        </section>

        {/* Call Sign-off */}
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <PhoneOff size={13} className="text-brand-500" />
            <label htmlFor="basics-signoff" className="text-sm font-semibold text-foreground">Sign-off</label>
          </div>
          <WordLimitTextarea
            id="basics-signoff"
            value={goals.callSignOff} onChange={v => setGoal('callSignOff', v)} limit={300}
            placeholder="Thank you for your time…"
            style={{ minHeight: '60px' }}
          />
          <SuggestionPills items={[signOffSuggestion]} onSelect={v => setGoal('callSignOff', v)} />
        </section>
      </div>
    </div>
  );
}
