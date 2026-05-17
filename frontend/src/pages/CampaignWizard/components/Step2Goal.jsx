import React from 'react';
import { Lightbulb, PhoneIncoming, PhoneOff, MessageSquarePlus } from 'lucide-react';

// ── Per-campaign-type goal suggestions ─────────────────────────────────────
const GOAL_SUGGESTIONS = {
  HR: [
    'Shortlist candidates for a software engineer interview',
    'Schedule a screening call with shortlisted applicants',
    'Verify candidate availability and confirm offer acceptance',
    'Collect expected CTC and notice period details',
  ],
  RECRUITER: [
    'Qualify leads for open positions at client companies',
    'Confirm consultant availability for an immediate deployment',
    'Pitch a new placement opportunity to passive candidates',
    'Follow up on submitted resumes and collect interview feedback',
  ],
  SALES: [
    'Book a product demo with a qualified prospect',
    'Upsell an annual subscription to existing monthly users',
    'Re-engage churned customers with a special offer',
    'Qualify inbound leads and hand off to an account executive',
  ],
  LOAN_RECOVERY: [
    'Remind the borrower about an overdue EMI and collect payment',
    'Negotiate a revised repayment schedule with a defaulting customer',
    'Verify updated contact details and confirm new payment date',
    'Alert guarantor about outstanding loan balance',
  ],
  FEEDBACK: [
    'Collect post-service CSAT score (1–5) and a brief comment',
    'Identify the top reason for customer dissatisfaction',
    'Measure NPS after a product delivery',
    'Gather structured feedback after a support ticket resolution',
  ],
};

// ── Intro / sign-off suggestions ────────────────────────────────────────────
const INTRO_SUGGESTIONS = {
  HR: 'Hi, this is an automated call from [Company] Talent Team. Am I speaking with [Name]? Great — I have a quick update about your job application.',
  RECRUITER: 'Hello [Name], this is [Agency] calling regarding an exciting opportunity that matches your profile. Do you have two minutes?',
  SALES: 'Hi [Name], I\'m reaching out from [Company]. We noticed you recently expressed interest in [Product] and I\'d love to share a quick update.',
  LOAN_RECOVERY: 'Good [morning/afternoon] [Name], this is an automated reminder from [Lender] regarding your account. Please stay on the line.',
  FEEDBACK: 'Hi [Name], this is a quick automated call from [Company] — we\'d love to hear about your recent experience with us. This will take less than a minute.',
};

const SIGNOFF_SUGGESTIONS = {
  HR: 'Thank you for your time today, [Name]. Our team will be in touch within the next 48 hours with the next steps. Have a great day!',
  RECRUITER: 'Thanks so much, [Name]. We\'ll review and get back to you shortly. Feel free to reach out to us anytime. Goodbye!',
  SALES: 'Wonderful — we\'ll send your demo invite shortly. Thanks for your time, [Name], and we look forward to speaking with you. Take care!',
  LOAN_RECOVERY: 'Thank you for your cooperation, [Name]. Please ensure payment is made before the due date to avoid further impact to your account. Goodbye.',
  FEEDBACK: 'Thank you so much for your feedback, [Name] — it genuinely helps us improve. Have a wonderful rest of your day. Goodbye!',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function wordCount(text) {
  return text?.trim().split(/\s+/).filter(Boolean).length || 0;
}

function WordLimitTextarea({ value, onChange, limit, placeholder, minHeight = '100px' }) {
  const count = wordCount(value);
  const over  = count > limit;

  return (
    <div className="flex flex-col gap-1">
      <textarea
        className={`flex w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y transition-colors
          ${over ? 'border-destructive focus-visible:ring-destructive' : 'border-input'}`}
        style={{ minHeight }}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <div className={`text-xs text-right tabular-nums ${over ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
        {count} / {limit} words{over ? ' — over limit' : ''}
      </div>
    </div>
  );
}

function SuggestionPills({ items, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {items.map(s => (
        <button
          key={s}
          type="button"
          onClick={() => onSelect(s)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40 bg-muted/30 px-3 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
        >
          <Lightbulb size={11} />
          {s.length > 60 ? s.slice(0, 57) + '…' : s}
        </button>
      ))}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export default function Step2Goal({ payload, updatePayload }) {
  const type = payload.type || 'HR';

  const goalSuggestions  = GOAL_SUGGESTIONS[type]  || GOAL_SUGGESTIONS.HR;
  const introSuggestion  = INTRO_SUGGESTIONS[type]  || '';
  const signOffSuggestion = SIGNOFF_SUGGESTIONS[type] || '';

  const goals   = payload.goals   || {};
  const setGoal = (field, val) => updatePayload({ goals: { ...goals, [field]: val } });

  return (
    <div className="animate-fade-in flex flex-col gap-8">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight">Call Design</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Define what success looks like and craft the words your AI agent will use.
        </p>
      </div>

      {/* ── Campaign Goal ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Lightbulb size={16} className="text-primary" />
          <h4 className="text-sm font-semibold">Campaign Goal</h4>
          <span className="text-xs text-muted-foreground">(max 100 words)</span>
        </div>
        <WordLimitTextarea
          value={goals.goal}
          onChange={v => setGoal('goal', v)}
          limit={100}
          placeholder="Describe what the AI agent should achieve on this call…"
          minHeight="80px"
        />
        <p className="text-xs text-muted-foreground">Suggestions for <span className="font-medium">{type.replace('_', ' ')}</span> campaigns — click to use:</p>
        <SuggestionPills items={goalSuggestions} onSelect={v => setGoal('goal', v)} />
      </section>

      {/* ── Call Introduction ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <PhoneIncoming size={16} className="text-primary" />
          <h4 className="text-sm font-semibold">Call Introduction</h4>
          <span className="text-xs text-muted-foreground">(max 300 words — what the bot says when call connects)</span>
        </div>
        <WordLimitTextarea
          value={goals.callIntro}
          onChange={v => setGoal('callIntro', v)}
          limit={300}
          placeholder="Hi, this is [Bot Name] calling from [Company]…"
          minHeight="110px"
        />
        <p className="text-xs text-muted-foreground">Suggested introduction for this campaign type:</p>
        <SuggestionPills items={[introSuggestion]} onSelect={v => setGoal('callIntro', v)} />
      </section>

      {/* ── Call Sign-off ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <PhoneOff size={16} className="text-primary" />
          <h4 className="text-sm font-semibold">Call Sign-off</h4>
          <span className="text-xs text-muted-foreground">(max 300 words — what the bot says before hanging up)</span>
        </div>
        <WordLimitTextarea
          value={goals.callSignOff}
          onChange={v => setGoal('callSignOff', v)}
          limit={300}
          placeholder="Thank you for your time. Our team will be in touch shortly…"
          minHeight="110px"
        />
        <p className="text-xs text-muted-foreground">Suggested sign-off for this campaign type:</p>
        <SuggestionPills items={[signOffSuggestion]} onSelect={v => setGoal('callSignOff', v)} />
      </section>

      {/* ── Courtesy Close ── */}
      <section className="flex items-start gap-4 p-4 rounded-xl border border-input bg-muted/20">
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <MessageSquarePlus size={16} className="text-primary" />
            <span className="text-sm font-semibold">Courtesy Close</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Before the sign-off, the bot will ask: <em className="text-foreground/70">"Is there anything else I can help you with?"</em> — giving the user a chance to raise additional queries before the call ends.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={goals.courtesyClose || false}
          onClick={() => setGoal('courtesyClose', !(goals.courtesyClose || false))}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            ${goals.courtesyClose ? 'bg-primary' : 'bg-input'}`}
        >
          <span
            className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform
              ${goals.courtesyClose ? 'translate-x-5' : 'translate-x-0'}`}
          />
        </button>
      </section>
    </div>
  );
}
