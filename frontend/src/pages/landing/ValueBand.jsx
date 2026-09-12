import React from 'react';
import { ClipboardCheck, Mic, ShieldCheck } from 'lucide-react';
import { Reveal, FloatingPill, Wave, IconChip } from './primitives';

export function ValueBand() {
  return (
    <section className="relative bg-[#0a0f1a] py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.12) 0%, transparent 70%)' }} />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
          <FloatingPill icon={ClipboardCheck} label="Automatic call scoring" />
          <FloatingPill icon={Mic} label="Real-time transcripts" bob={0.4} />
          <FloatingPill icon={ShieldCheck} label="Role-based access" bob={0.8} />
        </div>

        <Reveal>
          <h2 className="font-display text-3xl md:text-[2.75rem] font-semibold text-white leading-[1.1] tracking-tight">
            Outcomes you can measure<IconChip icon={ClipboardCheck} className="align-baseline" />without listening to a single call
          </h2>
          <p className="mt-5 text-sm text-slate-400 leading-relaxed max-w-xl mx-auto">
            Every conversation is transcribed, scored, and reported the moment it ends — so your team spends time acting on outcomes, not chasing them down.
          </p>
        </Reveal>
      </div>

      <Wave fill="#f8fafc" />
    </section>
  );
}
