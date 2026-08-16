import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#faq', label: 'FAQ' },
];

const FEATURES = [
  {
    icon: 'call',
    title: 'AI voice campaigns',
    body: 'Upload a contact list and a call objective — an AI agent places and conducts every outbound call for you, at any scale.',
  },
  {
    icon: 'fact_check',
    title: 'Automatic call evaluation',
    body: 'Every call is transcribed and scored with GPT-based evaluation — sentiment, outcome, and question-level quality — with no manual review.',
  },
  {
    icon: 'monitoring',
    title: 'Real-time reporting',
    body: 'Watch campaigns run live: completion rate, outcomes, and scores update on the dashboard as calls happen.',
  },
  {
    icon: 'share',
    title: 'Shareable reports',
    body: 'Send a campaign or call report to a teammate or client with a single link — no account required on their end.',
  },
  {
    icon: 'group',
    title: 'Workspaces & roles',
    body: 'Run multiple workspaces with role-based access for admins, editors, and viewers, so teams stay in their lane.',
  },
  {
    icon: 'payments',
    title: 'Usage-based billing',
    body: 'Consumption is tracked by call minutes, so you always know exactly what a campaign costs before and after it runs.',
  },
];

const STEPS = [
  { icon: 'upload_file', title: 'Upload contacts & script', body: 'Import your contact list and define what the AI agent should accomplish on the call.' },
  { icon: 'call', title: 'The AI agent calls', body: 'Calls go out over telephony automatically, following your objective in a natural conversation.' },
  { icon: 'fact_check', title: 'Every call is scored', body: 'Transcripts, sentiment, and outcome are captured and evaluated the moment a call ends.' },
  { icon: 'insights', title: 'Review results live', body: 'Track campaign performance on the dashboard, or share a report link with anyone who needs it.' },
];

const PILLARS = [
  { icon: 'dialer_sip', label: 'Enterprise telephony via Plivo' },
  { icon: 'smart_toy', label: 'GPT-powered call evaluation' },
  { icon: 'speed', label: 'Live dashboards, not batch reports' },
  { icon: 'admin_panel_settings', label: 'Role-based workspaces' },
];

const FAQS = [
  {
    q: 'What is AI Caller Pro?',
    a: 'AI Caller Pro is an AI-powered outbound calling platform. You launch a voice campaign, an AI agent conducts each call, and every call is automatically evaluated and reported on in real time.',
  },
  {
    q: 'How does the AI agent make calls?',
    a: 'Campaigns run over Plivo’s telephony network. The AI agent follows the objective you set for the campaign and holds a natural, real-time conversation with each contact.',
  },
  {
    q: 'How is call quality evaluated?',
    a: 'Every completed call is transcribed and scored automatically using GPT-based evaluation — covering sentiment, outcome (completed, reschedule, wrong person, and more), and question-level quality — so nobody has to listen to every recording.',
  },
  {
    q: 'Can I share results with my team or clients?',
    a: 'Yes. Campaign and call reports can be shared through a link without the recipient needing an account, and workspaces support role-based access for admins, editors, and viewers.',
  },
  {
    q: 'How do I get access?',
    a: 'Sign in to get started. Usage is tracked by call minutes so you can monitor and control consumption as campaigns scale.',
  },
];

function MiniLogo({ className = 'w-9 h-9' }) {
  return (
    <div className={`${className} rounded-xl bg-[#0d9488] flex items-center justify-center shrink-0`} style={{ boxShadow: '0 4px 14px rgba(13,148,136,0.35)' }}>
      <span className="material-symbols-outlined text-white text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>graphic_eq</span>
    </div>
  );
}

function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#0a0f1a]/95 backdrop-blur border-b border-white/5">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between" aria-label="Primary">
        <a href="#top" className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488] rounded-lg">
          <MiniLogo className="w-8 h-8" />
          <span className="font-bold text-white text-[15px] tracking-tight">AI Caller Pro</span>
        </a>

        <ul className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(l => (
            <li key={l.href}>
              <a href={l.href} className="text-[13.5px] font-medium text-slate-300 hover:text-white transition-colors">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-3">
          <Link to="/login" className="text-[13.5px] font-medium text-slate-300 hover:text-white transition-colors px-3 py-2 rounded-lg cursor-pointer">
            Sign in
          </Link>
          <Link
            to="/login"
            className="text-[13.5px] font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] transition-colors px-4 py-2.5 rounded-lg cursor-pointer"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="md:hidden w-10 h-10 flex items-center justify-center text-white rounded-lg hover:bg-white/5 cursor-pointer"
        >
          <span className="material-symbols-outlined">{open ? 'close' : 'menu'}</span>
        </button>
      </nav>

      {open && (
        <div id="mobile-menu" className="md:hidden border-t border-white/5 px-6 py-4 flex flex-col gap-1">
          {NAV_LINKS.map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-[14px] font-medium text-slate-300 hover:text-white py-2.5"
            >
              {l.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 mt-2">
            <Link to="/login" className="text-center text-[14px] font-medium text-slate-300 hover:text-white py-2.5 rounded-lg border border-white/10 cursor-pointer">
              Sign in
            </Link>
            <Link to="/login" className="text-center text-[14px] font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] py-2.5 rounded-lg cursor-pointer">
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

const BARS = [38, 55, 42, 70, 52, 85, 65, 90, 58, 75];
function SparkBars() {
  return (
    <div className="flex items-end gap-[3px] h-8" aria-hidden="true">
      {BARS.map((h, i) => (
        <div key={i} className="flex-1 rounded-sm bg-[#0d9488]" style={{ height: `${h}%`, opacity: 0.35 + (h / 100) * 0.65 }} />
      ))}
    </div>
  );
}

function ProductPreview() {
  return (
    <div
      className="relative rounded-2xl overflow-hidden w-full max-w-md mx-auto"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
      aria-hidden="true"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#0d9488]" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Campaign: Q1 Outreach</span>
        <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#0d9488]" style={{ background: 'rgba(13,148,136,0.14)' }}>
          Live
        </span>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { val: '312', label: 'Calls placed' },
            { val: '68%', label: 'Completed' },
            { val: '4.3', label: 'Avg score' },
          ].map(m => (
            <div key={m.label} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <p className="text-white font-bold text-lg leading-none">{m.val}</p>
              <p className="text-[10px] text-slate-500 mt-1.5">{m.label}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg p-3.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <p className="text-[10px] text-slate-500 mb-2">Calls completed · last 12 hrs</p>
          <SparkBars />
        </div>

        <ul className="space-y-2">
          {[
            { name: 'A. Sharma', outcome: 'Completed', tone: 'text-[#5eead4]' },
            { name: 'R. Patel', outcome: 'Reschedule', tone: 'text-amber-300' },
            { name: 'M. Fernandes', outcome: 'Completed', tone: 'text-[#5eead4]' },
          ].map(c => (
            <li key={c.name} className="flex items-center justify-between text-[12px] py-1">
              <span className="text-slate-300">{c.name}</span>
              <span className={`font-semibold ${c.tone}`}>{c.outcome}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section id="top" className="relative bg-[#0a0f1a] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 right-0 w-[32rem] h-[32rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.14) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28 grid lg:grid-cols-2 gap-14 items-center">
        <div>
          <p className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest mb-4">AI-Powered Voice Platform</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-[1.12] tracking-tight">
            AI voice agents that call, qualify, and report — automatically.
          </h1>
          <p className="mt-5 text-base md:text-lg text-slate-400 leading-relaxed max-w-lg">
            Launch outbound calling campaigns, let an AI agent handle every conversation, and get every call scored, transcribed, and reported on in real time.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-[14px] font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] transition-colors px-6 py-3.5 rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5eead4]"
            >
              Get started
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 text-[14px] font-semibold text-slate-200 hover:text-white border border-white/15 hover:border-white/30 transition-colors px-6 py-3.5 rounded-xl cursor-pointer"
            >
              See how it works
            </a>
          </div>

          <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-3 max-w-md">
            {PILLARS.map(p => (
              <li key={p.label} className="flex items-center gap-2 text-[12.5px] text-slate-400">
                <span className="material-symbols-outlined text-[16px] text-[#0d9488]" aria-hidden="true">{p.icon}</span>
                {p.label}
              </li>
            ))}
          </ul>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="bg-[#f8fafc] py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest mb-3">Features</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] tracking-tight">
            Everything you need to run AI voice campaigns
          </h2>
          <p className="mt-4 text-[15px] text-[#475569] leading-relaxed">
            From dialing to scoring to reporting — one platform handles the whole outbound calling workflow.
          </p>
        </div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map(f => (
            <article key={f.title} className="rounded-2xl bg-white border border-[#e2e8f0] p-6 hover:border-[#0d9488]/40 hover:shadow-[0_4px_24px_rgba(13,148,136,0.08)] transition-all">
              <div className="w-11 h-11 rounded-xl bg-[#f0fdfa] flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[#0d9488] text-[22px]" aria-hidden="true">{f.icon}</span>
              </div>
              <h3 className="text-[15px] font-bold text-[#0f172a] mb-2">{f.title}</h3>
              <p className="text-[13.5px] text-[#64748b] leading-relaxed">{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-20 md:py-28 border-t border-[#e2e8f0]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] tracking-tight">
            From contact list to reported outcome in four steps
          </h2>
        </div>

        <ol className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-9 h-9 rounded-full bg-[#0f172a] text-white text-[13px] font-bold flex items-center justify-center shrink-0" aria-hidden="true">
                  {i + 1}
                </span>
                <span className="material-symbols-outlined text-[#0d9488] text-[22px]" aria-hidden="true">{s.icon}</span>
              </div>
              <h3 className="text-[14.5px] font-bold text-[#0f172a] mb-1.5">{s.title}</h3>
              <p className="text-[13px] text-[#64748b] leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FaqItem({ item, isOpen, onToggle, id }) {
  return (
    <div className="border-b border-[#e2e8f0]">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={`${id}-panel`}
          id={`${id}-button`}
          className="w-full flex items-center justify-between gap-4 py-5 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488] rounded-lg"
        >
          <span className="text-[14.5px] font-semibold text-[#0f172a]">{item.q}</span>
          <span className={`material-symbols-outlined text-[#64748b] text-[20px] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
            expand_more
          </span>
        </button>
      </h3>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-button`}
        className={`grid transition-all duration-200 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100 pb-5' : 'grid-rows-[0fr] opacity-0'}`}
        style={{ display: 'grid' }}
      >
        <div className="overflow-hidden">
          <p className="text-[13.5px] text-[#64748b] leading-relaxed pr-8">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

function Faq() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="bg-[#f8fafc] py-20 md:py-28 border-t border-[#e2e8f0]">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] tracking-tight">
            Frequently asked questions
          </h2>
        </div>

        <div>
          {FAQS.map((item, i) => (
            <FaqItem
              key={item.q}
              id={`faq-${i}`}
              item={item}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="bg-[#0a0f1a] py-20 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.14) 0%, transparent 70%)' }} />
      </div>
      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
          Ready to put outbound calling on autopilot?
        </h2>
        <p className="mt-4 text-[15px] text-slate-400 max-w-xl mx-auto leading-relaxed">
          Sign in to launch your first AI voice campaign and see every call scored and reported in real time.
        </p>
        <div className="mt-8">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-[14px] font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] transition-colors px-7 py-3.5 rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5eead4]"
          >
            Get started
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-[#0a0f1a] border-t border-white/5 py-10">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
        <a href="#top" className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488] rounded-lg">
          <MiniLogo className="w-7 h-7" />
          <span className="font-bold text-white text-[13.5px] tracking-tight">AI Caller Pro</span>
        </a>

        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <li><a href="#features" className="text-[12.5px] text-slate-400 hover:text-white transition-colors">Features</a></li>
            <li><a href="#how-it-works" className="text-[12.5px] text-slate-400 hover:text-white transition-colors">How it works</a></li>
            <li><a href="#faq" className="text-[12.5px] text-slate-400 hover:text-white transition-colors">FAQ</a></li>
            <li><Link to="/support" className="text-[12.5px] text-slate-400 hover:text-white transition-colors">Support</Link></li>
            <li><Link to="/login" className="text-[12.5px] text-slate-400 hover:text-white transition-colors">Sign in</Link></li>
          </ul>
        </nav>

        <p className="text-[12px] text-slate-500">© {new Date().getFullYear()} AI Caller Pro. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default function Landing() {
  useEffect(() => {
    document.title = 'AI Caller Pro — AI Voice Calling & Outbound Campaign Platform';
  }, []);

  return (
    <div className="min-h-screen">
      <Nav />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
