import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, PhoneCall } from 'lucide-react';
import { motion } from 'framer-motion';
import { PILLARS } from './data';
import { Wave, FloatingPill } from './primitives';

// eslint's unused-vars check doesn't recognize `<MotionDiv>` (a member
// expression) as a use of `motion` — aliasing to a capitalized component
// avoids a false-positive "unused import" error without disabling the rule.
const MotionDiv = motion.div;

// A tiny animated audio-waveform, sitting inline mid-headline — AiCaller's
// own take on "an icon living inside the display text," using bars instead
// of a boxed icon since this product's whole identity is voice/audio.
function InlineWaveform() {
  const heights = [40, 90, 55, 100, 65, 85, 45];
  return (
    <span className="inline-flex items-center gap-[3px] mx-2 md:mx-3 h-[0.5em] align-middle" aria-hidden="true">
      {heights.map((h, i) => (
        <span key={i} className="w-[3px] md:w-1 rounded-full bg-[#0d9488]" style={{ height: `${h}%`, opacity: 0.5 + (h / 100) * 0.5 }} />
      ))}
    </span>
  );
}

const BARS = [38, 55, 42, 70, 52, 85, 65, 90, 58, 75];
function SparkBars() {
  return (
    <div className="flex items-end gap-[3px] h-8" aria-hidden="true">
      {BARS.map((h, i) => (
        <div key={i} className="flex-1 rounded-sm bg-[#0d9488]" style={{ height: `${h}%`, opacity: 0.35 + (h / 100) * 0.65 }} />
      ))}
    </div>
  );
}

// A light card (mirroring the reference site's white-cards-on-a-solid-color
// panel) with a second, rotated card peeking out behind it for a collage feel.
function ProductPreview() {
  return (
    <div className="relative w-full max-w-lg mx-auto" style={{ perspective: '1400px' }}>
      <MotionDiv
        initial={{ opacity: 0, rotate: 4, y: 20 }}
        animate={{ opacity: 0.5, rotate: 4, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 rounded-2xl bg-white/60 border border-white/40"
        style={{ transform: 'rotate(4deg) translateY(12px) scale(0.97)' }}
        aria-hidden="true"
      />

      <MotionDiv
        initial={{ opacity: 0, rotateY: -6, rotateX: 3, y: 30 }}
        animate={{ opacity: 1, rotateY: -6, rotateX: 3, y: 0 }}
        transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        style={{
          boxShadow: '0 40px 80px -20px rgba(0,0,0,0.35)',
          transformStyle: 'preserve-3d',
        }}
        className="relative rounded-2xl overflow-hidden bg-white border border-black/5"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-black/5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0d9488]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-[#8a8f87]">Campaign: Q1 Outreach</span>
          <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#0d9488] bg-[#0d9488]/10">
            Live
          </span>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { val: '312', label: 'Calls placed' },
              { val: '68%', label: 'Completed' },
              { val: '4.3', label: 'Avg score' },
            ].map(m => (
              <div key={m.label} className="rounded-lg p-3 bg-[#f6f5f1]">
                <p className="text-[#14261f] font-bold text-lg leading-none">{m.val}</p>
                <p className="text-[10px] text-[#8a8f87] mt-1.5">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg p-3.5 bg-[#f6f5f1]">
            <p className="text-[10px] text-[#8a8f87] mb-2">Calls completed · last 12 hrs</p>
            <SparkBars />
          </div>

          <ul className="space-y-2">
            {[
              { name: 'A. Sharma', outcome: 'Completed', tone: 'text-[#0d9488]' },
              { name: 'R. Patel', outcome: 'Reschedule', tone: 'text-amber-600' },
              { name: 'M. Fernandes', outcome: 'Completed', tone: 'text-[#0d9488]' },
            ].map(c => (
              <li key={c.name} className="flex items-center justify-between text-[12px] py-1">
                <span className="text-[#4b5148]">{c.name}</span>
                <span className={`font-semibold ${c.tone}`}>{c.outcome}</span>
              </li>
            ))}
          </ul>
        </div>
      </MotionDiv>

      <FloatingPill icon={PhoneCall} label="Auto-scored in real time" className="absolute -left-4 md:-left-10 top-8 hidden sm:inline-flex" />
      <FloatingPill icon={Compass} label="Natural, interruptible speech" className="absolute -right-4 md:-right-10 bottom-10 hidden sm:inline-flex" bob={0.6} />
    </div>
  );
}

export function Hero({ onTakeTour }) {
  return (
    <section id="top" className="relative bg-[#fbfaf6] overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-28">
        <MotionDiv
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-2.5 mb-6">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#0d9488]" aria-hidden="true" />
            <span className="text-sm text-[#4b5148]">The AI Voice Calling Platform</span>
          </div>

          <h1 className="font-display text-[2.75rem] leading-[1.05] md:text-6xl md:leading-[1.05] font-medium text-[#14261f] tracking-tight max-w-4xl">
            Where every<InlineWaveform />outbound call becomes a scored outcome
          </h1>

          <p className="mt-6 text-base text-[#5b6158] leading-relaxed max-w-xl">
            Launch outbound calling campaigns, let an AI agent handle every conversation, and get every call scored, transcribed, and reported on in real time.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#14261f] hover:bg-[#0d9488] transition-colors px-6 py-3.5 rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488]"
            >
              Get started
            </Link>
            <button
              type="button"
              onClick={onTakeTour}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#14261f] border-2 border-[#14261f] hover:border-[#0d9488] hover:text-[#0d9488] transition-colors px-6 py-3.5 rounded-xl cursor-pointer"
            >
              Take a tour
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>

          <ul className="mt-10 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-x-8 gap-y-3">
            {PILLARS.map(p => (
              <li key={p.label} className="flex items-center gap-2 text-xs font-medium text-[#5b6158]">
                <p.icon size={16} className="text-[#0d9488]" aria-hidden="true" />
                {p.label}
              </li>
            ))}
          </ul>
        </MotionDiv>
      </div>

      {/* Full-width solid-color panel holding the tilted screenshot collage —
          mirrors the reference site's structure: visual sits below the
          headline/CTAs, spanning the width, not beside the text. */}
      <div className="relative bg-[#0d9488] pt-16 pb-24 md:pt-20 md:pb-32 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true">
          <div className="absolute top-0 right-0 w-[28rem] h-[28rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)' }} />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <ProductPreview />
        </div>
      </div>

      <Wave fill="#ffffff" />
    </section>
  );
}
