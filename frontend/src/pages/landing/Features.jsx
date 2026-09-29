import React from 'react';
import { FEATURES } from './data';
import { Reveal, RevealGroup, RevealItem } from './primitives';

export function Features() {
  return (
    <section id="features" className="relative bg-paper-100 py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-6">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold text-[#266df0] uppercase tracking-widest mb-3">Features</p>
          <h2 className="font-display text-3xl md:text-4xl font-normal text-[#1c1d1f] tracking-tight">
            Everything you need to run AI voice campaigns
          </h2>
          <p className="mt-4 text-sm text-[#505967] leading-relaxed">
            From dialing to scoring to reporting — one platform handles the whole outbound calling workflow.
          </p>
        </Reveal>

        <RevealGroup className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(f => (
            <RevealItem key={f.title}>
              <article className="h-full rounded-2xl bg-paper-100 border border-[#e4e7ec] p-6 hover:border-[#266df0]/40 hover:shadow-[0_4px_24px_rgba(38,109,240,0.08)] hover:-translate-y-1 transition-all">
                <div className="w-11 h-11 rounded-xl bg-[#e8f0ff] flex items-center justify-center mb-4">
                  <f.icon size={20} className="text-[#266df0]" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-semibold text-[#1c1d1f] mb-2">{f.title}</h3>
                <p className="text-sm text-[#6f7988] leading-relaxed">{f.body}</p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
