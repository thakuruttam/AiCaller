import React from 'react';
import { Reveal } from './primitives';

export function DemoVideo() {
  return (
    <section id="demo" className="relative bg-[#f8fafc] py-20 md:py-28">
      <div className="max-w-4xl mx-auto px-6">
        <Reveal className="text-center max-w-2xl mx-auto">
          <p className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest mb-3">Demo</p>
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-[#0f172a] tracking-tight">
            See it in action
          </h2>
          <p className="mt-4 text-sm text-[#475569] leading-relaxed">
            A one-minute walkthrough of a real campaign — from the questions and branching logic behind the scenes, to a fully scored call.
          </p>
        </Reveal>

        <Reveal delay={0.15} className="mt-10 rounded-2xl overflow-hidden border border-[#e2e8f0] shadow-[0_8px_40px_rgba(15,23,42,0.08)] bg-black">
          <video
            className="w-full aspect-video"
            controls
            preload="metadata"
            playsInline
          >
            <source src="/demo.mp4" type="video/mp4" />
          </video>
        </Reveal>
      </div>
    </section>
  );
}
