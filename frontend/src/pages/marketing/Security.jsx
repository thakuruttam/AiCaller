import React from 'react';
import MarketingLayout from './Layout';
import { Container, PageHero, SectionHeading, FaqList } from './parts';
import { FinalCta } from './Sections';
import { SECURITY_SECTIONS, SECURITY_FAQS } from './content';
import { pageForPath } from '../../seo/pages';
import { useSeo } from '../../seo/useSeo';

export default function Security() {
  useSeo('/security');

  return (
    <MarketingLayout>
      <PageHero
        breadcrumbs={pageForPath('/security').breadcrumbs}
        eyebrow="Security"
        title="How AI Caller Pro protects your calls and data"
        intro="Your contacts, recordings and results stay inside your workspace. Here is how access, sharing and call data are protected — described as how the system works, not as badges."
      />

      {SECURITY_SECTIONS.map((section, i) => (
        <section key={section.title} className={`py-16 md:py-20 ${i % 2 ? 'bg-paper-200' : 'bg-paper-100'}`}>
          <Container>
            <h2 className="text-[clamp(1.5rem,2.6vw,2rem)] font-bold tracking-[-0.025em] text-ink-100">{section.title}</h2>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2">
              {section.items.map((item) => (
                <li key={item.title} className="rounded-2xl border border-paper-500 bg-paper-100 p-6">
                  <h3 className="flex items-center gap-2 text-base font-semibold text-ink-100">
                    <span className="material-symbols-outlined text-brand-500 [--icon-size:18px]" aria-hidden="true">verified_user</span>
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{item.body}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ))}

      <section className="bg-paper-100 py-16 md:py-24">
        <Container>
          <SectionHeading eyebrow="FAQ" title="Security questions" align="center" />
          <FaqList items={SECURITY_FAQS} className="mt-12" />
        </Container>
      </section>

      <FinalCta />
    </MarketingLayout>
  );
}
