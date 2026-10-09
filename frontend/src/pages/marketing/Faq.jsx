import React from 'react';
import { Link } from 'react-router-dom';
import MarketingLayout from './Layout';
import { Container, PageHero, FaqList } from './parts';
import { FinalCta } from './Sections';
import { FAQ_GROUPS } from './content';
import { pageForPath } from '../../seo/pages';
import { useSeo } from '../../seo/useSeo';

export default function FaqPage() {
  useSeo('/faq');

  return (
    <MarketingLayout>
      <PageHero
        breadcrumbs={pageForPath('/faq').breadcrumbs}
        eyebrow="FAQ"
        title="Frequently asked questions"
        intro="Answers about how the AI voice agent works, what it costs, and how your data is protected."
      />

      <section className="bg-paper-100 py-16 md:py-24">
        <Container className="grid gap-12 lg:grid-cols-[220px_1fr]">
          <nav aria-label="FAQ topics" className="lg:sticky lg:top-24 lg:self-start">
            <ul className="flex flex-wrap gap-2 lg:flex-col">
              {FAQ_GROUPS.map((g) => (
                <li key={g.id}>
                  <a href={`#${g.id}`} className="block rounded-control px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-paper-300 hover:text-ink-100">
                    {g.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-14">
            {FAQ_GROUPS.map((g) => (
              <section key={g.id} id={g.id} aria-labelledby={`${g.id}-title`} className="scroll-mt-24">
                <h2 id={`${g.id}-title`} className="mb-4 text-xl font-bold tracking-tight text-ink-100">{g.title}</h2>
                <FaqList items={g.items} className="!mx-0 !max-w-none" />
              </section>
            ))}
            <p className="text-[15px] text-ink-600">
              Still have a question? <Link to="/login" className="font-semibold text-brand-500 hover:underline">Sign in</Link> and
              open a support ticket from the Support page.
            </p>
          </div>
        </Container>
      </section>

      <FinalCta />
    </MarketingLayout>
  );
}
