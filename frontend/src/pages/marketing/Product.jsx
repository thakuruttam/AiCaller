import React from 'react';
import { Link } from 'react-router-dom';
import MarketingLayout from './Layout';
import { Container, PageHero, PrimaryCta, SecondaryCta, AppFrame } from './parts';
import { FinalCta } from './Sections';
import { PRODUCT_SECTIONS } from './content';
import { pageForPath } from '../../seo/pages';
import { useSeo } from '../../seo/useSeo';

export default function Product() {
  useSeo('/product');

  return (
    <MarketingLayout>
      <PageHero
        breadcrumbs={pageForPath('/product').breadcrumbs}
        eyebrow="Product"
        title="Everything an outbound calling team needs, in one place"
        intro="Build the call plan, import contacts, launch, and read scored results — the AI voice agent handles every conversation in between. Here is each part of the product in detail."
        actions={<>
          <PrimaryCta>Get started</PrimaryCta>
          <SecondaryCta as={Link} to="/pricing">See pricing</SecondaryCta>
        </>}
      />

      <nav aria-label="On this page" className="sticky top-16 z-30 border-b border-paper-500 bg-paper-100/90 backdrop-blur-md">
        <Container className="flex gap-6 overflow-x-auto py-3 scrollbar-none">
          {PRODUCT_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="shrink-0 text-sm font-medium text-ink-600 transition-colors hover:text-ink-100">
              {s.nav}
            </a>
          ))}
        </Container>
      </nav>

      {PRODUCT_SECTIONS.map((section, i) => (
        <section
          key={section.id}
          id={section.id}
          aria-labelledby={`${section.id}-title`}
          className={`scroll-mt-32 py-16 md:py-24 ${i % 2 ? 'bg-paper-200' : 'bg-paper-100'}`}
        >
          <Container>
            <div className="max-w-2xl">
              <h2 id={`${section.id}-title`} className="text-[clamp(1.6rem,3vw,2.25rem)] font-bold leading-tight tracking-[-0.025em] text-ink-100">
                {section.title}
              </h2>
              <p className="mt-3 text-[17px] leading-relaxed text-ink-600">{section.body}</p>
            </div>

            {section.image && (
              <AppFrame src={section.image.src} alt={section.image.alt} className="mt-10 max-w-5xl" />
            )}

            <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {section.features.map((f) => (
                <li key={f.title}>
                  <h3 className="flex items-center gap-2 text-base font-semibold text-ink-100">
                    <span className="material-symbols-outlined text-brand-500 [--icon-size:18px]" aria-hidden="true">check_circle</span>
                    {f.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{f.body}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      ))}

      <FinalCta />
    </MarketingLayout>
  );
}
