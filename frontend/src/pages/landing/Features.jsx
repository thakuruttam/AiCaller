import React from 'react';
import { FEATURES } from './data';
import { Reveal, RevealGroup, RevealItem, Wave } from './primitives';

export function Features() {
  return (
    <section id="features" className="relative bg-white py-20 md:py-28">
      <div className="max-w-6xl mx-auto px-6">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest mb-3">Features</p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-[#0f172a] tracking-tight">
            Everything you need to run AI voice campaigns
          </h2>
          <p className="mt-4 text-sm text-[#475569] leading-relaxed">
            From dialing to scoring to reporting — one platform handles the whole outbound calling workflow.
          </p>
        </Reveal>

        <RevealGroup className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(f => (
            <RevealItem key={f.title}>
              <article className="h-full rounded-2xl bg-white border border-[#e2e8f0] p-6 hover:border-[#0d9488]/40 hover:shadow-[0_4px_24px_rgba(13,148,136,0.08)] hover:-translate-y-1 transition-all">
                <div className="w-11 h-11 rounded-xl bg-[#f0fdfa] flex items-center justify-center mb-4">
                  <f.icon size={20} className="text-[#0d9488]" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-semibold text-[#0f172a] mb-2">{f.title}</h3>
                <p className="text-sm text-[#64748b] leading-relaxed">{f.body}</p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>

      <Wave fill="#f8fafc" />
    </section>
  );
}
