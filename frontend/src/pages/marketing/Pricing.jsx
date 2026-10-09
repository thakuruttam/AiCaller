import React from 'react';
import MarketingLayout from './Layout';
import { Container, Eyebrow, PrimaryCta, SectionHeading, FaqList, Breadcrumbs } from './parts';
import { FinalCta } from './Sections';
import { PRICING, PRICING_FAQS } from './content';
import { pageForPath } from '../../seo/pages';
import { useSeo } from '../../seo/useSeo';

const inr = (n) => `₹${n.toLocaleString('en-IN')}`;
const limit = (n, unit) => (n === -1 ? `Unlimited ${unit}` : `${n.toLocaleString('en-IN')} ${unit}`);

export default function Pricing() {
  useSeo('/pricing');
  const lowest = PRICING[PRICING.length - 1].ratePerMin;

  return (
    <MarketingLayout>
      <section className="bg-paper-200 pt-28 pb-16 sm:pt-32">
        <Container>
          <Breadcrumbs items={pageForPath('/pricing').breadcrumbs} className="mb-8" />
          <div className="max-w-3xl">
            <Eyebrow>Pricing</Eyebrow>
            <h1 className="mt-5 text-[clamp(2rem,5vw,3.25rem)] font-bold leading-[1.08] tracking-[-0.03em] text-ink-100">
              Pay per call minute. No subscription.
            </h1>
            <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-600">
              Buy a prepaid pack of minutes and spend it across any campaign. Larger packs bring the rate
              down to {`₹${lowest.toFixed(2)}`} per minute and unlock higher team and campaign limits. The AI voice
              agent, transcription and automatic evaluation of every call are included in the rate.
            </p>
          </div>
        </Container>
      </section>

      <section aria-labelledby="packs" className="bg-paper-100 py-16 md:py-24">
        <Container>
          <h2 id="packs" className="sr-only">Minute packs</h2>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PRICING.map((p) => (
              <li key={p.id} className="flex flex-col rounded-2xl border border-paper-500 bg-paper-100 p-6 shadow-card">
                <h3 className="text-sm font-semibold text-ink-100">{p.label}</h3>
                <p className="mt-3 text-4xl font-bold tracking-tight text-ink-100">{inr(p.amountInr)}</p>
                <p className="mt-1 text-sm text-ink-600">
                  <span className="font-semibold text-brand-500">{p.minutes.toLocaleString('en-IN')} minutes</span>
                  {' · '}₹{p.ratePerMin.toFixed(2)}/min
                </p>
                <ul className="mt-6 space-y-2.5 text-sm text-ink-600">
                  {[
                    limit(p.limits.teamMembers, 'team members'),
                    limit(p.limits.workspaces, p.limits.workspaces === 1 ? 'workspace' : 'workspaces'),
                    limit(p.limits.campaigns, p.limits.campaigns === 1 ? 'active campaign' : 'active campaigns'),
                    `${limit(p.limits.contacts, 'contacts')} per campaign`,
                    p.limits.api ? 'API access' : null,
                  ].filter(Boolean).map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <span className="material-symbols-outlined mt-0.5 shrink-0 text-brand-500 [--icon-size:16px]" aria-hidden="true">check</span>
                      {line}
                    </li>
                  ))}
                </ul>
                <PrimaryCta className="mt-8 w-full !h-11">Get started</PrimaryCta>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-center text-sm text-ink-700">
            Prices in Indian rupees. Every campaign shows its estimated cost before it starts.
          </p>
        </Container>
      </section>

      <section className="bg-paper-200 py-16 md:py-24">
        <Container>
          <SectionHeading eyebrow="FAQ" title="Pricing questions" align="center" />
          <FaqList items={PRICING_FAQS} className="mt-12" />
        </Container>
      </section>

      <FinalCta />
    </MarketingLayout>
  );
}
