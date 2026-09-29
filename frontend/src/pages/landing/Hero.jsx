import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, PhoneCall, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-fade';
import { PILLARS } from './data';
import { FloatingPill } from './primitives';

// eslint's unused-vars check doesn't recognize `<MotionDiv>` (a member
// expression) as a use of `motion` — aliasing to a capitalized component
// avoids a false-positive "unused import" error without disabling the rule.
const MotionDiv = motion.div;
const MotionSpan = motion.span;

const MotionSpanBar = motion.span;

// A tiny animated audio-waveform, sitting inline mid-headline — AiCaller's
// own take on "an icon living inside the display text," using bars instead
// of a boxed icon since this product's whole identity is voice/audio. Pops
// in ~0.9s after the rest of the headline, then keeps bouncing continuously
// like a live audio visualizer — a one-time pop is too easy to miss on a
// quick glance or a slow connection; a never-stopping loop reads as "alive"
// unambiguously.
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
        <MotionSpanBar
          key={i}
          className="w-[3px] md:w-1 rounded-full bg-[#266df0] origin-bottom"
          // A static height set via plain style, animated with `scaleY` (a
          // transform) rather than animating `height` itself — framer-motion
          // doesn't reliably re-trigger percentage-based `height` keyframes
          // on a loop (confirmed: computed height was frozen on inspection),
          // while transform-based scale always animates correctly.
          style={{ height: `${h}%`, opacity: 0.5 + (h / 100) * 0.5 }}
          animate={{ scaleY: [0.35, 1, 0.35] }}
          transition={{ duration: 0.9 + (i % 3) * 0.15, repeat: Infinity, ease: 'easeInOut', delay: 1.2 + i * 0.06 }}
        />
      ))}
    </MotionSpan>
  );
}

const BARS = [38, 55, 42, 70, 52, 85, 65, 90, 58, 75];
function SparkBars() {
  return (
    <div className="flex items-end gap-[3px] h-8" aria-hidden="true">
      {BARS.map((h, i) => (
        <div key={i} className="flex-1 rounded-sm bg-[#266df0]" style={{ height: `${h}%`, opacity: 0.35 + (h / 100) * 0.65 }} />
      ))}
    </div>
  );
}

function CardChrome({ children }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-paper-100 border border-black/5">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#266df0]" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-[#8a8f87]">Campaign: Q1 Outreach</span>
        <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#266df0] bg-[#266df0]/10">Live</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function OverviewSlide() {
  return (
    <CardChrome>
      <div className="space-y-4">
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
            { name: 'A. Sharma', outcome: 'Completed', tone: 'text-[#266df0]' },
            { name: 'R. Patel', outcome: 'Reschedule', tone: 'text-caution-dim' },
            { name: 'M. Fernandes', outcome: 'Completed', tone: 'text-[#266df0]' },
          ].map(c => (
            <li key={c.name} className="flex items-center justify-between text-[12px] py-1">
              <span className="text-[#4b5148]">{c.name}</span>
              <span className={`font-semibold ${c.tone}`}>{c.outcome}</span>
            </li>
          ))}
        </ul>
      </div>
    </CardChrome>
  );
}

function ObjectivesSlide() {
  return (
    <CardChrome>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a8f87] mb-3">Call Objectives</p>
      <ul className="space-y-2.5">
        {[
          { label: 'Confirm identity', done: true },
          { label: 'Ask notice period', done: true },
          { label: 'Capture salary expectations', done: false },
        ].map(o => (
          <li key={o.label} className="flex items-center gap-2.5 rounded-lg bg-[#f6f5f1] px-3 py-2.5">
            <CheckCircle2 size={15} className={o.done ? 'text-[#266df0]' : 'text-[#c8cdc4]'} />
            <span className="text-[12px] text-[#14261f]">{o.label}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="mt-4 w-full text-center text-[12px] font-semibold text-white bg-[#14261f] rounded-lg py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 cursor-pointer transition-colors">
        View full transcript
      </button>
    </CardChrome>
  );
}

function ScheduleSlide() {
  return (
    <CardChrome>
      <p className="text-[13px] font-semibold text-[#14261f] mb-3">Campaign schedule</p>
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        {[
          { val: '3 days', label: 'Duration' },
          { val: '8 min', label: 'Est. / call' },
          { val: '40', label: 'Contacts' },
        ].map(m => (
          <div key={m.label} className="rounded-lg p-3 bg-[#f6f5f1]">
            <p className="text-[#14261f] font-bold text-sm leading-none">{m.val}</p>
            <p className="text-[10px] text-[#8a8f87] mt-1.5">{m.label}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#8a8f87] mb-2">Questions</p>
      <div className="space-y-2">
        {[70, 45, 90].map((r, i) => (
          <div key={i} className="h-2.5 rounded-full bg-[#eceae2]" style={{ width: `${r}%` }} />
        ))}
      </div>
    </CardChrome>
  );
}

// The main, front-most card auto-cycles through a few different screens
// (Swiper fade + autoplay) — the reference site's own front card does the
// same, swapping content every couple of seconds while the side cards behind
// it stay put. Confirmed by watching it directly rather than assuming a
// single static card.
function MainCard() {
  return (
    <Swiper
      modules={[Autoplay, EffectFade]}
      effect="fade"
      fadeEffect={{ crossFade: true }}
      autoplay={{ delay: 2600, disableOnInteraction: false }}
      loop
    >
      <SwiperSlide><OverviewSlide /></SwiperSlide>
      <SwiperSlide><ObjectivesSlide /></SwiperSlide>
      <SwiperSlide><ScheduleSlide /></SwiperSlide>
    </Swiper>
  );
}

// A simpler, dimmer side card — just enough content to read as a real screen,
// not a decorative blank rectangle.
function SideCard({ title, rows }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-paper-100 border border-black/5 p-4 w-full h-full">
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
// The hero used to show an abstract collage of blank tilted cards, which told
// a visitor nothing about the product. This frames a real screenshot of the
// running app in browser chrome instead — the fastest way to convey what the
// thing actually is.
export function ProductShot({ src, alt, caption, className = '', priority = false }) {
  return (
    <figure className={`w-full ${className}`}>
      <div className="rounded-card overflow-hidden border border-black/10 bg-paper-100 shadow-[0_24px_60px_-20px_rgba(20,38,31,0.35)]">
        {/* Browser chrome — reads instantly as "this is the real app". */}
        <div className="flex items-center gap-2 px-3 py-2.5 bg-[#f6f5f1] border-b border-black/[0.07]">
          <span className="flex gap-1.5" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
          </span>
          <span className="flex-1 mx-2 h-5 rounded-full bg-paper-100 border border-black/[0.06] flex items-center justify-center">
            <span className="text-[10px] text-[#8a8f87] tracking-tight">app.aicaller.store</span>
          </span>
        </div>
        <img
          src={src}
          alt={alt}
          width={1483}
          height={812}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="block w-full h-auto"
        />
      </div>
      {caption && (
        <figcaption className="mt-3 text-sm text-[#5b6158] text-center">{caption}</figcaption>
      )}
    </figure>
  );
}

function ProductPreview() {
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 90, damping: 18, delay: 0.25 }}
      className="relative w-full max-w-4xl mx-auto"
    >
      <ProductShot
        priority
        src="/product/dashboard.jpg"
        alt="The AI Caller Pro dashboard: total calls queued, completed calls and success rate, above a table of live campaigns with per-campaign progress and cost."
      />

      <FloatingPill icon={PhoneCall} label="Auto-scored in real time" className="absolute -left-10 xl:-left-16 top-10 hidden xl:inline-flex" />
      <FloatingPill icon={ShieldCheck} label="Role-based workspaces" className="absolute -right-10 xl:-right-16 bottom-10 hidden xl:inline-flex" bob={0.6} />
    </MotionDiv>
  );
}

export function Hero({ onTakeTour }) {
  return (
    <section id="top" className="relative bg-[#fbfaf6] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 pt-[120px] pb-16">
        <MotionDiv
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center gap-2.5 mb-7">
            <span className="w-2 h-2 rounded-sm bg-[#266df0]" aria-hidden="true" />
            <span className="text-base text-[#4b5148]">The AI Voice Calling Platform</span>
          </div>

          <h1 className="font-display text-[2.75rem] leading-[1.03] md:text-[4.25rem] md:leading-[1.03] font-normal text-[#14261f] tracking-tight max-w-[920px]">
            Where every<InlineWaveform />outbound call becomes a scored outcome
          </h1>

          <p className="mt-5 text-xl leading-[1.45] text-[#5b6158] max-w-xl">
            Launch outbound calling campaigns, let an AI agent handle every conversation, and get every call scored, transcribed, and reported on in real time.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-base font-semibold text-white bg-[#266df0] hover:bg-[#245bc2] transition-colors px-6 py-3 rounded-control cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#266df0]/40 focus-visible:ring-offset-2"
            >
              Get started
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={onTakeTour}
              className="inline-flex items-center gap-2 text-base font-medium text-[#14261f] hover:text-[#266df0] transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              Take a tour
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </MotionDiv>
      </div>

      {/* Inset rounded panel holding the tilted screenshot collage — the
          reference site's panel is a simple rounded rectangle sitting inset
          within the page (border-radius ~16px, ~2:1 aspect ratio), not a
          full-bleed section with a wavy cut. Matched exactly here. */}
      <div className="max-w-7xl mx-auto px-6 pb-20 md:pb-28">
        <div className="relative bg-[#266df0] rounded-card overflow-hidden flex items-center justify-center px-4 sm:px-8 md:px-14 py-10 md:py-16">
          <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true">
            <div className="absolute top-0 right-0 w-[28rem] h-[28rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)' }} />
          </div>
          <div className="relative w-full">
            <ProductPreview />
          </div>
        </div>
      </div>

      {/* Compact capabilities strip — the real PILLARS content, kept out of
          the headline block itself so the hero text stays as uncluttered as
          the reference site's (badge → headline → subhead → CTAs, nothing else). */}
      <div className="relative bg-paper-100 py-6">
        <ul className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {PILLARS.map(p => (
            <li key={p.label} className="flex items-center gap-2 text-xs font-medium text-[#5b6158]">
              <p.icon size={15} className="text-[#266df0]" aria-hidden="true" />
              {p.label}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
