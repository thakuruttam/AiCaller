import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, PhoneCall, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { PILLARS } from './data';
import { Wave, FloatingPill } from './primitives';

// eslint's unused-vars check doesn't recognize `<MotionDiv>` (a member
// expression) as a use of `motion` — aliasing to a capitalized component
// avoids a false-positive "unused import" error without disabling the rule.
const MotionDiv = motion.div;
const MotionSpan = motion.span;

// A tiny animated audio-waveform, sitting inline mid-headline — AiCaller's
// own take on "an icon living inside the display text," using bars instead
// of a boxed icon since this product's whole identity is voice/audio. Pops
// in ~0.9s after the rest of the headline, matching the reference site's own
// inline-icon entrance timing (it isn't part of the initial paint there either).
function InlineWaveform() {
  const heights = [40, 90, 55, 100, 65, 85, 45];
  return (
    <MotionSpan
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.9, ease: [0.34, 1.56, 0.64, 1] }}
      className="inline-flex items-center gap-[3px] mx-2 md:mx-3 h-[0.5em] align-middle"
      aria-hidden="true"
    >
      {heights.map((h, i) => (
        <span key={i} className="w-[3px] md:w-1 rounded-full bg-[#0d9488]" style={{ height: `${h}%`, opacity: 0.5 + (h / 100) * 0.5 }} />
      ))}
    </MotionSpan>
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

// The main, front-most card — full dashboard detail.
function MainCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-black/5">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#0d9488]" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#8a8f87]">Campaign: Q1 Outreach</span>
        <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#0d9488] bg-[#0d9488]/10">Live</span>
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
    </div>
  );
}

// A simpler, dimmer side card — just enough content to read as a real screen,
// not a decorative blank rectangle.
function SideCard({ title, rows }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-black/5 p-4 w-full h-full">
      <p className="text-[13px] font-semibold text-[#14261f] mb-3">{title}</p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="h-2.5 rounded-full bg-[#eceae2]" style={{ width: `${r}%` }} />
        ))}
      </div>
    </div>
  );
}

// Four fanned, tilted cards — mirrors the reference site's hero collage
// structure (a wide front-and-center dashboard card flanked by two dimmer
// cards on each side) rather than the single-card mock this page had before.
// Each card flies into its fanned position with a staggered delay on mount.
function ProductPreview() {
  const cards = [
    { key: 'far-left', style: { left: '-6%', top: '18%', width: '34%', rotate: -14, z: 1, opacity: 0.55 }, from: { x: -60, rotate: -30 } },
    { key: 'near-left', style: { left: '10%', top: '6%', width: '38%', rotate: -7, z: 2, opacity: 0.8 }, from: { x: -40, rotate: -20 } },
    { key: 'far-right', style: { right: '-6%', top: '20%', width: '34%', rotate: 12, z: 1, opacity: 0.55 }, from: { x: 60, rotate: 30 } },
  ];

  return (
    <div className="relative w-full max-w-3xl mx-auto" style={{ perspective: '1400px', minHeight: '380px' }}>
      {cards.map((c, i) => (
        <MotionDiv
          key={c.key}
          initial={{ opacity: 0, y: 30, x: c.from.x, rotate: c.from.rotate }}
          animate={{ opacity: c.style.opacity, y: 0, x: 0, rotate: c.style.rotate }}
          transition={{ duration: 0.9, delay: 0.15 + i * 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="absolute"
          style={{ left: c.style.left, right: c.style.right, top: c.style.top, width: c.style.width, zIndex: c.style.z, boxShadow: '0 30px 60px -20px rgba(0,0,0,0.3)' }}
        >
          <SideCard
            title={c.key === 'near-left' ? 'Coaching plan' : 'Call history'}
            rows={c.key === 'near-left' ? [70, 45, 90, 30] : [55, 80, 40]}
          />
        </MotionDiv>
      ))}

      <MotionDiv
        initial={{ opacity: 0, y: 40, rotateY: -6, rotateX: 3 }}
        animate={{ opacity: 1, y: 0, rotateY: -6, rotateX: 3 }}
        transition={{ duration: 0.9, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ boxShadow: '0 40px 80px -20px rgba(0,0,0,0.35)', transformStyle: 'preserve-3d', zIndex: 3 }}
        className="relative w-[62%] mx-auto"
      >
        <MainCard />
      </MotionDiv>

      <FloatingPill icon={PhoneCall} label="Auto-scored in real time" className="absolute left-0 top-0 hidden sm:inline-flex" />
      <FloatingPill icon={ShieldCheck} label="Role-based workspaces" className="absolute right-0 bottom-0 hidden sm:inline-flex" bob={0.6} />
    </div>
  );
}

export function Hero({ onTakeTour }) {
  return (
    <section id="top" className="relative bg-[#fbfaf6] overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 pt-[120px] pb-16">
        <MotionDiv
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-2.5 mb-7">
            <span className="w-2 h-2 rounded-sm bg-[#0d9488]" aria-hidden="true" />
            <span className="text-base text-[#4b5148]">The AI Voice Calling Platform</span>
          </div>

          <h1 className="font-display text-[2.75rem] leading-[1.03] md:text-[4.25rem] md:leading-[1.03] font-medium text-[#14261f] tracking-tight max-w-[920px]">
            Where every<InlineWaveform />outbound call becomes a scored outcome
          </h1>

          <p className="mt-5 text-xl leading-[1.45] text-[#5b6158] max-w-xl">
            Launch outbound calling campaigns, let an AI agent handle every conversation, and get every call scored, transcribed, and reported on in real time.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-base font-medium text-white bg-[#14261f] hover:bg-[#0d9488] transition-colors px-6 py-2.5 rounded-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488]"
            >
              Get started
            </Link>
            <button
              type="button"
              onClick={onTakeTour}
              className="inline-flex items-center gap-2 text-base font-medium text-[#14261f] hover:text-[#0d9488] transition-colors cursor-pointer"
            >
              Take a tour
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </MotionDiv>
      </div>

      {/* Full-width solid-color panel holding the tilted screenshot collage —
          mirrors the reference site's structure: visual sits below the
          headline/CTAs, spanning the width, not beside the text. */}
      <div className="relative bg-[#0d9488] pt-16 pb-24 md:pt-20 md:pb-32 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true">
          <div className="absolute top-0 right-0 w-[28rem] h-[28rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)' }} />
        </div>
        <div className="relative">
          <ProductPreview />
        </div>

        <Wave fill="#ffffff" />
      </div>

      {/* Compact capabilities strip — the real PILLARS content, kept out of
          the headline block itself so the hero text stays as uncluttered as
          the reference site's (badge → headline → subhead → CTAs, nothing else). */}
      <div className="relative bg-white py-6">
        <ul className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {PILLARS.map(p => (
            <li key={p.label} className="flex items-center gap-2 text-xs font-medium text-[#5b6158]">
              <p.icon size={15} className="text-[#0d9488]" aria-hidden="true" />
              {p.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
