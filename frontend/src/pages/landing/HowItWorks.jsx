import React from 'react';
import { STEPS } from './data';
import { Reveal, RevealGroup, RevealItem } from './primitives';

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative bg-[#f8fafc] py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest mb-3">How it works</p>
          <h2 className="font-display text-3xl md:text-4xl font-normal text-[#0f172a] tracking-tight">
            From contact list to reported outcome in four steps
          </h2>
        </Reveal>

        <RevealGroup className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map((s, i) => (
            <RevealItem key={s.title} className="relative">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-9 h-9 rounded-full bg-[#0f172a] text-white text-[13px] font-bold flex items-center justify-center shrink-0" aria-hidden="true">
                  {i + 1}
                </span>
                <s.icon size={20} className="text-[#0d9488]" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold text-[#0f172a] mb-1.5">{s.title}</h3>
              <p className="text-sm text-[#64748b] leading-relaxed">{s.body}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
