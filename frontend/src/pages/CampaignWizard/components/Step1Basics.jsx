import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Lightbulb, PhoneIncoming, PhoneOff } from 'lucide-react';

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
        className={`flex w-full rounded-lg border bg-white dark:bg-slate-700 px-3 pt-2 pb-6 text-sm text-zinc-900 dark:text-slate-100 placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 resize-y transition-colors
          ${over
            ? 'border-red-400 focus:ring-red-500/20'
            : 'border-zinc-300 dark:border-slate-600 focus:border-indigo-500 focus:ring-indigo-500/20'
          }`}
        style={{ minHeight }}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <div className={`absolute bottom-2 right-6 text-[10px] pointer-events-none tabular-nums bg-white/90 dark:bg-slate-700/90 px-1 backdrop-blur-sm rounded ${over ? 'text-red-500 font-semibold' : 'text-zinc-400 dark:text-slate-500'}`}>
        {count} / {limit} words{over ? ' — over limit' : ''}
      </div>
    </div>
  );
}

function SuggestionPills({ items, onSelect }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-0.5">
      {items.map((s, i) => (
        <button
          key={i} type="button" onClick={() => onSelect(s)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 dark:border-slate-600 bg-zinc-50 dark:bg-slate-800/50 px-2.5 py-0.5 text-[11px] text-zinc-500 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
        >
          <Lightbulb size={10} />
          {s.length > 50 ? s.slice(0, 47) + '…' : s}
        </button>
      ))}
    </div>
  );
}

export default function Step1Basics({ payload, updatePayload }) {
  const { user } = useAuth();
  const type = payload.type || 'HR';

  const goalSuggestions   = GOAL_SUGGESTIONS[type]   || GOAL_SUGGESTIONS.HR;
  const introSuggestion   = INTRO_SUGGESTIONS[type]  || '';
  const signOffSuggestion = SIGNOFF_SUGGESTIONS[type] || '';

  const goals = payload.goals || {};
  const setGoal = (field, val) => updatePayload({ goals: { ...goals, [field]: val } });

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-slate-100 tracking-tight">Campaign Basics</h3>
        <p className="text-zinc-500 dark:text-slate-400 text-sm mt-1">
          Give your campaign a name, choose its type, and craft the words your AI agent will use.
        </p>
      </div>

      {/* Campaign name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold text-zinc-700 dark:text-slate-300">
          Campaign Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          className="h-9 w-full rounded-lg border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 text-sm text-zinc-900 dark:text-slate-100 placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors"
          value={payload.name}
          onChange={e => updatePayload({ name: e.target.value })}
          placeholder="e.g. Q3 Software Engineer Hiring"
        />
      </div>

      {/* Campaign type */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-semibold text-zinc-700 dark:text-slate-300">
          Campaign Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
          {CAMPAIGN_TYPES.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => updatePayload({ type: value })}
              className={`flex flex-col items-start gap-0.5 p-2.5 rounded-lg border text-left transition-all
                ${payload.type === value
                  ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-zinc-700 dark:text-slate-300 hover:bg-zinc-50 dark:hover:bg-slate-700/50'
                }`}
            >
              <span className="text-[13px] font-semibold">{label}</span>
              <span className="text-[10px] text-zinc-400 dark:text-slate-500 leading-snug">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5 mt-2 pt-6 border-t border-zinc-100 dark:border-slate-700/50">
        {/* Campaign Goal */}
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Lightbulb size={13} className="text-indigo-600" />
            <h4 className="text-[13px] font-semibold text-zinc-800 dark:text-slate-200">Primary Goal</h4>
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
            <PhoneIncoming size={13} className="text-indigo-600" />
            <h4 className="text-[13px] font-semibold text-zinc-800 dark:text-slate-200">Introduction</h4>
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
            <PhoneOff size={13} className="text-indigo-600" />
            <h4 className="text-[13px] font-semibold text-zinc-800 dark:text-slate-200">Sign-off</h4>
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
