import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, SectionHeading, Eyebrow, PrimaryCta, SecondaryCta, AppFrame, FaqList } from './parts';
import { TOUR, CAPABILITIES, STEPS, TRUST, FAQS } from './content';

// ── Hero ────────────────────────────────────────────────────────────────────
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-paper-200 pt-28 pb-16 sm:pt-32 md:pb-24">
      <Container className="relative">
        <div className="mx-auto max-w-3xl text-center animate-rise">
          <Eyebrow className="justify-center">AI voice calling for outbound teams</Eyebrow>

          <h1 className="mt-5 text-[clamp(2.25rem,6vw,4rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-ink-100">
            Every outbound call,
            <br className="hidden sm:block" />{' '}
            <span className="text-brand-500">scored the moment it ends</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-ink-600 sm:text-lg">
            Launch outbound calling campaigns, let an AI agent hold every conversation, and get
            each call transcribed, scored and reported on in real time.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <PrimaryCta>Get started</PrimaryCta>
            <SecondaryCta as={Link} to="/use-cases">See use cases</SecondaryCta>
          </div>

          <p className="mt-5 text-[13px] text-ink-700">
            No-code campaign builder · 30 voices · English, Hindi &amp; Hinglish
          </p>
        </div>

        <div className="relative mx-auto mt-14 max-w-5xl animate-rise" style={{ animationDelay: '120ms' }}>
          <AppFrame
            priority
            src="/product/dashboard.jpg"
            alt="The AI Caller Pro dashboard: calls queued, completed calls and success rate, above a table of live campaigns with progress and spend."
          />
        </div>
      </Container>
    </section>
  );
}

// ── Product tour ────────────────────────────────────────────────────────────
export function ProductTour() {
  const [active, setActive] = useState(TOUR[0].key);
  const shot = TOUR.find(t => t.key === active) ?? TOUR[0];

  return (
    <section id="product" className="scroll-mt-24 bg-paper-100 py-20 md:py-28">
      <Container>
        <SectionHeading
          eyebrow="The product"
          title="From contact list to scored outcome"
          body="Three screens your team lives in. This is the running application, not a mock-up."
        />

        <div className="mt-10 hidden md:block">
          <div role="tablist" aria-label="Product screens" className="inline-flex gap-1 rounded-control border border-paper-500 bg-paper-200 p-1">
            {TOUR.map(t => (
              <button
                key={t.key}
                role="tab"
                aria-selected={active === t.key}
                onClick={() => setActive(t.key)}
                className={`cursor-pointer rounded-field px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/40 ${
                  active === t.key ? 'bg-paper-100 text-ink-100 shadow-card' : 'text-ink-600 hover:text-ink-100'
                }`}
              >
                <span className="mr-1.5 tabular text-ink-800">{t.step}</span>
                {t.label}
              </button>
            ))}
          </div>

          <div key={shot.key} className="mt-8 grid grid-cols-12 items-center gap-10 animate-fade-in">
            <div className="col-span-4">
              <h3 className="text-2xl font-semibold leading-snug tracking-[-0.02em] text-ink-100">{shot.title}</h3>
              <p className="mt-3 leading-relaxed text-ink-600">{shot.body}</p>
              <ul className="mt-5 space-y-2.5">
                {shot.points.map(p => (
                  <li key={p} className="flex items-start gap-2.5 text-[15px] text-ink-600">
                    <span className="material-symbols-outlined mt-0.5 shrink-0 text-brand-500 [--icon-size:18px]">check_circle</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-span-8">
              <AppFrame src={shot.src} alt={shot.alt} />
            </div>
          </div>
        </div>

        {/* Phones get every screen by scrolling — no tab to discover first. */}
        <div className="mt-10 space-y-14 md:hidden">
          {TOUR.map(t => (
            <div key={t.key}>
              <p className="mb-1 text-xs font-medium tabular text-ink-800">{t.step} · {t.label}</p>
              <h3 className="text-xl font-semibold leading-snug tracking-[-0.02em] text-ink-100">{t.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-600">{t.body}</p>
              <AppFrame className="mt-5" src={t.src} alt={t.alt} />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ── Capabilities ────────────────────────────────────────────────────────────
export function Capabilities() {
  return (
    <section id="capabilities" className="scroll-mt-24 bg-paper-200 py-20 md:py-28">
      <Container>
        <SectionHeading
          eyebrow="Capabilities"
          title="Built for conversations that branch"
          body="A phone tree follows a script. This follows the answer."
        />

        <div className="mt-12 grid gap-px overflow-hidden rounded-card border border-paper-500 bg-paper-500 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map(c => (
            <article key={c.title} className="group bg-paper-100 p-6 transition-colors hover:bg-paper-200">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-chip bg-brand-100 text-brand-500 transition-colors group-hover:bg-brand-500 group-hover:text-white">
                <span className="material-symbols-outlined [--icon-size:20px]">{c.icon}</span>
              </span>
              <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-ink-100">{c.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{c.body}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}

// ── How it works ────────────────────────────────────────────────────────────
export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 bg-paper-100 py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow="How it works" title="Four steps, no engineering" />

        <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(s => (
            <li key={s.n} className="relative">
              <span className="text-[13px] font-semibold tabular text-brand-500">{s.n}</span>
              <h3 className="mt-2 text-[17px] font-semibold tracking-[-0.01em] text-ink-100">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{s.body}</p>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

// ── Trust / architecture ────────────────────────────────────────────────────
export function Trust() {
  return (
    <section id="security" className="scroll-mt-24 bg-ink-50 py-20 text-paper-200 md:py-28">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Eyebrow className="mb-4">Built to be trusted</Eyebrow>
            <h2 className="text-[clamp(1.75rem,3.4vw,2.6rem)] font-semibold leading-[1.12] tracking-[-0.025em] text-paper-100">
              Multi-tenant by construction
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-ink-900">
              Isolation and limits are enforced in the data layer and the dispatcher — not implied
              by the interface.
            </p>
          </div>

          <div className="grid gap-px overflow-hidden rounded-card bg-ink-400 sm:grid-cols-2 lg:col-span-7">
            {TRUST.map(t => (
              <div key={t.title} className="bg-ink-100 p-6">
                <span className="material-symbols-outlined text-brand-300 [--icon-size:20px]">{t.icon}</span>
                <h3 className="mt-3 text-[15px] font-semibold text-paper-100">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-900">{t.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}

// ── FAQ ─────────────────────────────────────────────────────────────────────
export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 bg-paper-200 py-20 md:py-28">
      <Container>
        <SectionHeading eyebrow="FAQ" title="Questions we get asked" align="center" />
        <FaqList items={FAQS} className="mt-12" />
      </Container>
    </section>
  );
}

// ── Closing CTA ─────────────────────────────────────────────────────────────
export function FinalCta() {
  return (
    <section className="bg-paper-100 py-20 md:py-28">
      <Container>
        <div className="relative overflow-hidden rounded-card bg-brand-500 px-6 py-16 text-center sm:px-12">
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-[clamp(1.75rem,3.4vw,2.5rem)] font-semibold leading-[1.12] tracking-[-0.025em] text-white">
              Put outbound calling on autopilot
            </h2>
            <p className="mt-4 text-[17px] leading-relaxed text-brand-100">
              Launch your first campaign and see every call scored as it lands.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/login"
                className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-control bg-paper-100 px-6 text-[15px] font-semibold text-brand-600 outline-none transition-colors hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-500"
              >
                Get started
                <span className="material-symbols-outlined [--icon-size:18px]">arrow_forward</span>
              </Link>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
