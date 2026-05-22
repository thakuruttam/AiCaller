import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Lightbulb, PhoneIncoming, PhoneOff } from 'lucide-react';

const CAMPAIGN_TYPES = [
  { value: 'HR',            label: 'HR',            desc: 'Recruitment & talent outreach' },
  { value: 'RECRUITER',     label: 'Recruiter',      desc: 'Agency staffing calls' },
  { value: 'SALES',         label: 'Sales',          desc: 'Lead gen & product demos' },
  { value: 'LOAN_RECOVERY', label: 'Loan Recovery',  desc: 'EMI reminders & collections' },
  { value: 'FEEDBACK',      label: 'Feedback',       desc: 'CSAT & post-service surveys' },
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
  SALES: 'Hi [Name], I\'m reaching out from [Company]. We noticed you recently expressed interest in [Product].',
  LOAN_RECOVERY: 'Good [morning/afternoon] [Name], this is an automated reminder from [Lender].',
  FEEDBACK: 'Hi [Name], this is a quick automated call from [Company] — we\'d love to hear about your experience.',
};

const SIGNOFF_SUGGESTIONS = {
  HR: 'Thank you for your time today. Our team will be in touch shortly. Have a great day!',
  RECRUITER: 'Thanks so much. We\'ll review and get back to you shortly. Goodbye!',
  SALES: 'Wonderful — we\'ll send your demo invite shortly. Thanks for your time!',
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
        className={`flex w-full rounded-md border bg-background px-3 pt-2 pb-6 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y transition-colors
          ${over ? 'border-destructive focus-visible:ring-destructive' : 'border-input'}`}
        style={{ minHeight }}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <div className={`absolute bottom-2 right-6 text-[10px] pointer-events-none tabular-nums bg-background/80 px-1 backdrop-blur-sm rounded ${over ? 'text-destructive font-semibold' : 'text-muted-foreground/70'}`}>
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
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 bg-muted/30 px-2.5 py-0.5 text-[11px] text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
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

  const goalSuggestions   = GOAL_SUGGESTIONS[type]  || GOAL_SUGGESTIONS.HR;
  const introSuggestion   = INTRO_SUGGESTIONS[type]  || '';
  const signOffSuggestion = SIGNOFF_SUGGESTIONS[type] || '';

  const goals = payload.goals || {};
  const setGoal = (field, val) => updatePayload({ goals: { ...goals, [field]: val } });

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight">Campaign Basics</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Give your campaign a name, choose its type, and craft the words your AI agent will use.
        </p>
      </div>

      {/* Campaign name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium leading-none">
          Campaign Name <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={payload.name}
          onChange={e => updatePayload({ name: e.target.value })}
          placeholder="e.g. Q3 Software Engineer Hiring"
        />
      </div>

      {/* Campaign type */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium leading-none">
          Campaign Type <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
          {CAMPAIGN_TYPES.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => updatePayload({ type: value })}
              className={`flex flex-col items-start gap-0.5 p-2.5 rounded-lg border text-left transition-all
                ${payload.type === value
                  ? 'border-primary ring-1 ring-primary bg-primary/5 text-primary'
                  : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
            >
              <span className="text-[13px] font-semibold">{label}</span>
              <span className="text-[10px] text-muted-foreground leading-snug">{desc}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5 mt-2 pt-6 border-t border-border/50">
        {/* Campaign Goal */}
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Lightbulb size={14} className="text-primary" />
            <h4 className="text-[13px] font-semibold">Primary Goal</h4>
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
            <PhoneIncoming size={14} className="text-primary" />
            <h4 className="text-[13px] font-semibold">Introduction</h4>
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
            <PhoneOff size={14} className="text-primary" />
            <h4 className="text-[13px] font-semibold">Sign-off</h4>
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
