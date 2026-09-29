import React, { useState, useRef } from 'react';
import { Button, IconButton, SelectableCard } from '../../../components/ui';
import { Lightbulb, PhoneIncoming, PhoneOff, Timer, Mic, Play, Square, Loader2 } from 'lucide-react';
import api from '../../../api/axios';

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

function wordCount(text) {
  return text?.trim().split(/\s+/).filter(Boolean).length || 0;
}

function WordLimitTextarea({ value, onChange, limit, placeholder, minHeight = '60px' }) {
  const count = wordCount(value);
  const over  = count > limit;
  return (
    <div className="relative flex flex-col">
      <textarea
        className={`flex w-full rounded-control border bg-paper-100 dark:bg-ink-300 px-3 pt-2 pb-6 text-sm text-ink-100 dark:text-paper-200 placeholder:text-ink-800 dark:placeholder:text-ink-700 focus:outline-none focus:ring-2 resize-y transition-colors
          ${over
            ? 'border-negative focus:ring-negative/20'
            : 'border-paper-600 dark:border-ink-400 focus:border-brand-500 focus:ring-brand-500/20'
          }`}
        style={{ minHeight }}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <div className={`absolute bottom-2 right-6 text-xs font-medium pointer-events-none tabular-nums bg-white/90 dark:bg-ink-300/90 px-1 backdrop-blur-sm rounded ${over ? 'text-negative font-semibold' : 'text-ink-800 dark:text-ink-800'}`}>
        {count} / {limit} words{over ? ' — over limit' : ''}
      </div>
    </div>
  );
}

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
        <h3 className="text-2xl font-bold text-ink-100 dark:text-paper-200 tracking-tight">Campaign Basics</h3>
        <p className="text-ink-700 dark:text-ink-900 text-sm mt-1">
          Give your campaign a name, choose its type, and craft the words your AI agent will use.
        </p>
      </div> */}

      {/* Campaign name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-ink-500 dark:text-ink-900">
          Campaign Name <span className="text-negative">*</span>
        </label>
        <input
          type="text"
          className="h-9 w-full rounded-control border border-paper-600 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 px-3 text-sm text-ink-100 dark:text-paper-200 placeholder:text-ink-800 dark:placeholder:text-ink-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors"
          value={payload.name}
          onChange={e => updatePayload({ name: e.target.value })}
          placeholder="e.g. Q3 Software Engineer Hiring"
        />
      </div>

      {/* Campaign type */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-ink-500 dark:text-ink-900">
          Campaign Type <span className="text-negative">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
          {CAMPAIGN_TYPES.map(({ value, label, desc }) => (
            <SelectableCard
              key={value}
              compact
              selected={payload.type === value}
              onSelect={() => updatePayload({ type: value })}
            >
              <span className="block text-xs font-semibold text-ink-100 dark:text-paper-200">{label}</span>
              <span className="block text-xs text-ink-700 dark:text-ink-800 leading-snug mt-0.5">{desc}</span>
            </SelectableCard>
          ))}
        </div>
      </div>

      {/* Max Call Duration */}
      <div className="flex flex-col gap-1.5 mt-2 pt-6 border-t border-paper-400 dark:border-ink-400/50">
        <div className="flex items-center gap-1.5">
          <Timer size={13} className="text-brand-500" />
          <label className="text-sm font-semibold text-ink-100 dark:text-paper-200">
            Max Call Duration <span className="text-negative">*</span>
          </label>
        </div>
        <p className="text-xs font-medium text-ink-700 dark:text-ink-900 -mt-0.5">
          The call will automatically end 4 seconds before this limit. Can be overridden per contact.
        </p>
        <div className="flex items-center gap-3 mt-1">
          <div className="relative w-32">
            <input
              type="number"
              min="1"
              max="60"
              value={payload.callSettings?.maxDuration ?? 5}
              onChange={e => {
                const v = Math.max(1, Math.min(60, parseInt(e.target.value) || 1));
                updatePayload({ callSettings: { ...(payload.callSettings || {}), maxDuration: v } });
              }}
              className="h-9 w-full rounded-control border border-paper-600 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 px-3 text-sm text-ink-100 dark:text-paper-200 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <span className="text-sm text-ink-700">minutes per call</span>
          {payload.callSettings?.maxDuration && (
            <span className="text-xs font-medium text-ink-800">
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
          <label className="text-sm font-semibold text-ink-100 dark:text-paper-200">Voice</label>
        </div>
        <p className="text-xs font-medium text-ink-700 dark:text-ink-900 -mt-0.5">
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
                  <span className="truncate text-xs font-semibold text-ink-100 dark:text-paper-200">{label}</span>
                  <span className="truncate text-[10px] text-ink-700 dark:text-ink-800">
                    {recommended ? 'Recommended · ' : ''}{desc}
                  </span>
                </span>
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Preview ${label}`}
                  onClick={(e) => { e.stopPropagation(); playVoicePreview(value); }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); playVoicePreview(value); } }}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-ink-800 hover:text-brand-500 hover:bg-brand-100 cursor-pointer"
                  title={`Preview ${label}`}
                >
                  {isThis && previewingVoice.state === 'loading' && <Loader2 size={13} className="animate-spin" />}
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
            <h4 className="text-sm font-semibold text-ink-100 dark:text-paper-200">Primary Goal</h4>
          </div>
          <WordLimitTextarea
            value={goals.goal} onChange={v => setGoal('goal', v)} limit={100}
            placeholder="Describe what the agent should achieve…"
            minHeight="60px"
          />
          <SuggestionPills items={goalSuggestions} onSelect={v => setGoal('goal', v)} />
        </section>

        {/* Call Introduction */}
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <PhoneIncoming size={13} className="text-brand-500" />
            <h4 className="text-sm font-semibold text-ink-100 dark:text-paper-200">Introduction</h4>
          </div>
          <WordLimitTextarea
            value={goals.callIntro} onChange={v => setGoal('callIntro', v)} limit={300}
            placeholder="Hi, this is [Bot] calling from…"
            minHeight="60px"
          />
          <SuggestionPills items={[introSuggestion]} onSelect={v => setGoal('callIntro', v)} />
        </section>

        {/* Call Sign-off */}
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <PhoneOff size={13} className="text-brand-500" />
            <h4 className="text-sm font-semibold text-ink-100 dark:text-paper-200">Sign-off</h4>
          </div>
          <WordLimitTextarea
            value={goals.callSignOff} onChange={v => setGoal('callSignOff', v)} limit={300}
            placeholder="Thank you for your time…"
            minHeight="60px"
          />
          <SuggestionPills items={[signOffSuggestion]} onSelect={v => setGoal('callSignOff', v)} />
        </section>
      </div>
    </div>
  );
}
