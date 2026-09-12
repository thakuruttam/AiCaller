import React from 'react';
import { motion } from 'framer-motion';

// See Hero.jsx for why this alias exists (eslint doesn't see `<MotionDiv>`
// member-expression JSX as a use of the `motion` import).
const MotionDiv = motion.div;

// Curved "torn paper" section transition — an organic wave instead of a hard
// straight edge between sections. `fill` should match the section BELOW this
// divider (it sits at the bottom of the section above, overlapping into it).
export function Wave({ fill, flip = false, className = '' }) {
  return (
    <div className={`absolute left-0 right-0 bottom-0 translate-y-[1px] pointer-events-none overflow-hidden leading-[0] ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 1440 110"
        preserveAspectRatio="none"
        className="w-full h-[70px] md:h-[110px]"
        style={flip ? { transform: 'scaleX(-1)' } : undefined}
      >
        <path
          d="M0,64 C240,110 480,10 720,40 C960,70 1200,20 1440,58 L1440,110 L0,110 Z"
          fill={fill}
        />
      </svg>
    </div>
  );
}

// Fades + slides an element up into place the first time it scrolls into view.
export function Reveal({ children, delay = 0, className = '', y = 24 }) {
  return (
    <MotionDiv
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </MotionDiv>
  );
}

// Same as Reveal, but staggers its direct children — use for grids/lists.
export function RevealGroup({ children, className = '', stagger = 0.08 }) {
  return (
    <MotionDiv
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
      className={className}
    >
      {children}
    </MotionDiv>
  );
}

export function RevealItem({ children, className = '', y = 20 }) {
  return (
    <MotionDiv
      variants={{ hidden: { opacity: 0, y }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }}
      className={className}
    >
      {children}
    </MotionDiv>
  );
}

// A small pill badge that gently bobs in place, used to float capability
// callouts near the hero mockup — echoes ReflexAI's floating stat pills, with
// AiCaller's own real feature labels rather than fabricated numbers.
export function FloatingPill({ icon: Icon, label, className = '', bob = 0 }) {
  // Two nested motion elements, not one: `whileInView` and a looping `animate`
  // both drive the same transform/opacity system in framer-motion, so putting
  // them on one element makes `animate` silently win and the reveal (or the
  // loop) never plays. The outer div owns the one-time scroll reveal; the
  // inner div owns the continuous bob.
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className={className}
    >
      <MotionDiv
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: bob }}
        className={`inline-flex items-center gap-2 rounded-full bg-[#0f1729]/90 border border-white/10 px-4 py-2 shadow-lg shadow-black/20 backdrop-blur`}
      >
        {Icon && <Icon size={14} className="text-[#5eead4] shrink-0" />}
        <span className="text-xs font-medium text-slate-200 whitespace-nowrap">{label}</span>
      </MotionDiv>
    </MotionDiv>
  );
}

// A small icon-in-a-pill mark meant to sit inline, mid-sentence, inside a
// display headline — mirrors the "icon chip in the headline" trick.
export function IconChip({ icon: Icon, className = '' }) {
  return (
    <span className={`inline-flex items-center justify-center align-middle mx-1.5 -mt-2 w-[0.85em] h-[0.85em] rounded-2xl bg-[#0d9488] ${className}`}>
      <Icon className="w-[55%] h-[55%] text-white" strokeWidth={2.5} />
    </span>
  );
}
