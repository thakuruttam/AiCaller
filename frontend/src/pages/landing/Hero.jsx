import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Compass, PhoneCall } from 'lucide-react';
import { motion } from 'framer-motion';
import { PILLARS } from './data';
import { Wave, FloatingPill, IconChip } from './primitives';

// eslint's unused-vars check doesn't recognize `<MotionDiv>` (a member
// expression) as a use of `motion` — aliasing to a capitalized component
// avoids a false-positive "unused import" error without disabling the rule.
const MotionDiv = motion.div;

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

function ProductPreview() {
  return (
    <div
      className="relative w-full max-w-md mx-auto"
      style={{ perspective: '1200px' }}
    >
      <MotionDiv
        initial={{ opacity: 0, rotateY: -8, rotateX: 4, y: 30 }}
        animate={{ opacity: 1, rotateY: -8, rotateX: 4, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 40px 80px -20px rgba(0,0,0,0.6)',
          transformStyle: 'preserve-3d',
        }}
        className="relative rounded-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0d9488]" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Campaign: Q1 Outreach</span>
          <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#0d9488]" style={{ background: 'rgba(13,148,136,0.14)' }}>
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
              <div key={m.label} className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p className="text-white font-bold text-lg leading-none">{m.val}</p>
                <p className="text-[10px] text-slate-500 mt-1.5">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg p-3.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <p className="text-[10px] text-slate-500 mb-2">Calls completed · last 12 hrs</p>
            <SparkBars />
          </div>

          <ul className="space-y-2">
            {[
              { name: 'A. Sharma', outcome: 'Completed', tone: 'text-[#5eead4]' },
              { name: 'R. Patel', outcome: 'Reschedule', tone: 'text-amber-300' },
              { name: 'M. Fernandes', outcome: 'Completed', tone: 'text-[#5eead4]' },
            ].map(c => (
              <li key={c.name} className="flex items-center justify-between text-[12px] py-1">
                <span className="text-slate-300">{c.name}</span>
                <span className={`font-semibold ${c.tone}`}>{c.outcome}</span>
              </li>
            ))}
          </ul>
        </div>
      </MotionDiv>

      <FloatingPill icon={PhoneCall} label="Auto-scored in real time" className="absolute -left-6 top-10 hidden lg:inline-flex" />
      <FloatingPill icon={Compass} label="Natural, interruptible speech" className="absolute -right-8 bottom-16 hidden lg:inline-flex" bob={0.6} />
    </div>
  );
}

export function Hero({ onTakeTour }) {
  return (
    <section id="top" className="relative bg-[#0a0f1a] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 right-0 w-[32rem] h-[32rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.14) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-28 md:pt-24 md:pb-36 grid lg:grid-cols-2 gap-14 items-center">
        <MotionDiv
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest mb-4">The AI Voice Calling Platform</p>
          <h1 className="font-display text-4xl md:text-[3.4rem] font-semibold text-white leading-[1.08] tracking-tight">
            Where every<IconChip icon={PhoneCall} />outbound call becomes a scored outcome
          </h1>
          <p className="mt-5 text-sm text-slate-400 leading-relaxed max-w-lg">
            Launch outbound calling campaigns, let an AI agent handle every conversation, and get every call scored, transcribed, and reported on in real time.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] transition-colors px-6 py-3.5 rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5eead4]"
            >
              Get started
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={onTakeTour}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200 hover:text-white border border-white/15 hover:border-white/30 transition-colors px-6 py-3.5 rounded-xl cursor-pointer"
            >
              <Compass size={17} />
              Take a tour
            </button>
          </div>

          <ul className="mt-10 grid grid-cols-2 gap-x-6 gap-y-3 max-w-md">
            {PILLARS.map(p => (
              <li key={p.label} className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <p.icon size={16} className="text-[#0d9488]" aria-hidden="true" />
                {p.label}
              </li>
            ))}
          </ul>
        </MotionDiv>

        <ProductPreview />
      </div>

      <Wave fill="#ffffff" />
    </section>
  );
}
