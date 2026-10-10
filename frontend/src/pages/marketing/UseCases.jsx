import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import MarketingLayout from './Layout';
import { Container, SectionHeading, PrimaryCta, SecondaryCta, PageHero } from './parts';
import { FinalCta } from './Sections';
import { USE_CASES, STEPS } from './content';
import { pageForPath } from '../../seo/pages';
import { useSeo } from '../../seo/useSeo';

function UseCaseCard({ useCase }) {
  return (
    <li>
      <Link
        to={`/use-cases/${useCase.slug}`}
        className="group flex h-full flex-col rounded-2xl border border-paper-500 bg-paper-100 p-6 shadow-card outline-none transition-colors hover:border-brand-500/40 focus-visible:ring-2 focus-visible:ring-brand-500/40"
      >
        <h3 className="text-base font-semibold text-ink-100">{useCase.name}</h3>
        <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-600">{useCase.description}</p>
        <span className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-brand-500">
          Learn more
          <span className="material-symbols-outlined transition-transform group-hover:translate-x-0.5 [--icon-size:16px]" aria-hidden="true">arrow_forward</span>
        </span>
      </Link>
    </li>
  );
}

export function UseCasesIndex() {
  useSeo('/use-cases');
  return (
    <MarketingLayout>
      <PageHero
        breadcrumbs={pageForPath('/use-cases').breadcrumbs}
        eyebrow="Use cases"
        title="One AI voice agent, five kinds of outbound call"
        intro="Every campaign type uses the same building blocks — your questions, branching on each answer, plain-English scoring, and a transcript and evaluation for every call. Pick the one closest to the calls your team makes today."
      />
      <section className="bg-paper-100 py-16 md:py-24">
        <Container>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((u) => <UseCaseCard key={u.slug} useCase={u} />)}
          </ul>
        </Container>
      </section>
      <FinalCta />
    </MarketingLayout>
  );
}

export function UseCaseDetail() {
  const { slug } = useParams();
  const useCase = USE_CASES.find((u) => u.slug === slug);
  useSeo(`/use-cases/${slug}`);
  if (!useCase) return <Navigate to="/use-cases" replace />;
  const others = USE_CASES.filter((u) => u.slug !== slug);

  return (
    <MarketingLayout>
      <PageHero
        breadcrumbs={pageForPath(`/use-cases/${slug}`).breadcrumbs}
        eyebrow={useCase.name}
        title={useCase.h1}
        intro={useCase.intro}
        actions={<>
          <PrimaryCta>{useCase.cta}</PrimaryCta>
          <SecondaryCta as={Link} to="/pricing">See pricing</SecondaryCta>
        </>}
      />

      <section className="bg-paper-100 py-16 md:py-24">
        <Container className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink-100">What the agent does on each call</h2>
            <ul className="mt-6 space-y-3">
              {useCase.tasks.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink-600">
                  <span className="material-symbols-outlined mt-0.5 shrink-0 text-brand-500 [--icon-size:18px]" aria-hidden="true">call</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-ink-100">What your team gets back</h2>
            <ul className="mt-6 space-y-3">
              {useCase.outcomes.map((o) => (
                <li key={o} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink-600">
                  <span className="material-symbols-outlined mt-0.5 shrink-0 text-brand-500 [--icon-size:18px]" aria-hidden="true">check_circle</span>
                  {o}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section className="bg-paper-200 py-16 md:py-24">
        <Container>
          <SectionHeading eyebrow="How it works" title="From contact list to scored calls" />
          <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-2xl border border-paper-500 bg-paper-100 p-6">
                <p className="text-sm font-semibold text-brand-500">{s.n}</p>
                <h3 className="mt-2 text-base font-semibold text-ink-100">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="bg-paper-100 py-16 md:py-24">
        <Container>
          <h2 className="text-2xl font-bold tracking-tight text-ink-100">Other use cases</h2>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((u) => <UseCaseCard key={u.slug} useCase={u} />)}
          </ul>
        </Container>
      </section>

      <FinalCta />
    </MarketingLayout>
  );
}
