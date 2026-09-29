import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ProductShot } from './Hero';

const MotionDiv = motion.div;

// Three real screens from the running app, in the order a customer meets them.
// The previous landing page described the product but never showed it; this is
// the section that answers "what am I actually buying".
const SHOTS = [
  {
    key: 'build',
    step: '01',
    label: 'Build',
    title: 'Build a campaign without writing a script',
    body: 'Pick the campaign type, set a call budget, choose one of 30 voices, then add your questions and branching rules. No code, no prompt engineering.',
    src: '/product/campaign-builder.jpg',
    alt: 'The campaign builder: campaign name, campaign type tiles, max call duration, and a grid of selectable AI voices.',
  },
  {
    key: 'run',
    step: '02',
    label: 'Run',
    title: 'Watch every campaign as it dials',
    body: 'Live totals for calls queued, completed and success rate — with per-campaign progress and a running cost estimate before the campaign finishes.',
    src: '/product/dashboard.jpg',
    alt: 'The dashboard: calls queued, completed calls and success rate, over a table of active campaigns with progress bars and spend.',
  },
  {
    key: 'review',
    step: '03',
    label: 'Review',
    title: 'Every call transcribed, scored and attributable',
    body: 'Drill into a campaign for per-contact outcomes, durations and call status — then open any single call for its transcript, recording and evaluation.',
    src: '/product/campaign-report.jpg',
    alt: 'A campaign detail view listing every contact with call status, duration and a link into the individual call report.',
  },
];

export function ProductTour() {
  const [active, setActive] = useState(SHOTS[0].key);
  const shot = SHOTS.find(s => s.key === active) ?? SHOTS[0];

  return (
    <section id="product" className="bg-paper-100 py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-[#266df0] mb-3">See it in action</p>
          <h2 className="font-display text-[2rem] md:text-[2.75rem] leading-[1.1] text-[#14261f] tracking-tight">
            From contact list to scored outcome
          </h2>
          <p className="mt-4 text-lg text-[#5b6158]">
            The same three screens your team lives in, every day.
          </p>
        </div>

        {/* Tabs on desktop; the shots stack on their own below the md breakpoint
            so a phone never has to pick before it can see anything. */}
        <div className="mt-10 hidden md:block">
          <div
            role="tablist"
            aria-label="Product screens"
            className="inline-flex items-center gap-1 p-1 rounded-control bg-[#f6f5f1] border border-black/[0.06]"
          >
            {SHOTS.map(s => (
              <button
                key={s.key}
                role="tab"
                aria-selected={active === s.key}
                onClick={() => setActive(s.key)}
                className={`px-4 py-2 rounded-field text-sm font-medium transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#266df0]/40 ${
                  active === s.key
                    ? 'bg-paper-100 text-[#14261f] shadow-card'
                    : 'text-[#5b6158] hover:text-[#14261f]'
                }`}
              >
                <span className="text-[#8a8f87] mr-1.5 tabular">{s.step}</span>
                {s.label}
              </button>
            ))}
          </div>

          <MotionDiv
            key={shot.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 grid grid-cols-12 gap-10 items-center"
          >
            <div className="col-span-4">
              <h3 className="font-display text-2xl leading-snug text-[#14261f]">{shot.title}</h3>
              <p className="mt-3 text-[#5b6158] leading-relaxed">{shot.body}</p>
            </div>
            <div className="col-span-8">
              <ProductShot src={shot.src} alt={shot.alt} />
            </div>
          </MotionDiv>
        </div>

        {/* Stacked, no tabs — every screen is visible by scrolling. */}
        <div className="mt-10 space-y-12 md:hidden">
          {SHOTS.map(s => (
            <div key={s.key}>
              <p className="text-xs font-medium text-[#8a8f87] mb-1 tabular">{s.step} · {s.label}</p>
              <h3 className="font-display text-xl leading-snug text-[#14261f]">{s.title}</h3>
              <p className="mt-2 text-[#5b6158] leading-relaxed">{s.body}</p>
              <ProductShot className="mt-5" src={s.src} alt={s.alt} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
