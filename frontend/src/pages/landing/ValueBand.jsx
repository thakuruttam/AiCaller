import React from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, Mic, ShieldCheck, PhoneCall } from 'lucide-react';
import { Wave, IconChip, Reveal } from './primitives';

const MotionDiv = motion.div;

// A continuously morphing organic blob (animated border-radius) with a static
// dashed outline echo behind it — the reference site's decorative background
// treatment for its scroll-through feature callouts. Pure CSS/SVG technique,
// not a copied asset.
function MorphingBlob() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
      <div
        className="absolute w-[26rem] h-[26rem] md:w-[34rem] md:h-[34rem] border border-dashed border-[#0d9488]/30"
        style={{ borderRadius: '48% 52% 60% 40% / 40% 45% 55% 60%' }}
      />
      <MotionDiv
        className="absolute w-[20rem] h-[20rem] md:w-[26rem] md:h-[26rem] bg-[#0d9488]/[0.08]"
        animate={{
          borderRadius: [
            '42% 58% 65% 35% / 45% 45% 55% 55%',
            '58% 42% 38% 62% / 55% 65% 35% 45%',
            '42% 58% 65% 35% / 45% 45% 55% 55%',
          ],
        }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
}

const CALLOUTS = [
  { icon: PhoneCall, text: 'AI-powered call handling, designed for real-world conversation.' },
  { icon: Mic, text: 'Every call transcribed, live, with no manual note-taking.' },
  { icon: ShieldCheck, text: 'Role-based access, so the right people see the right calls.' },
];

// Three caption cards revealed one after another as the section scrolls into
// view — an approximation of the reference site's sticky-scroll cycling
// captions, without full scroll-jacking: each card fades/slides in on its own
// scroll trigger, positioned around the blob rather than all appearing at once.
function CalloutCards() {
  const positions = [
    'top-4 left-[8%] md:left-[14%]',
    'top-1/2 -translate-y-1/2 right-[4%] md:right-[10%]',
    'bottom-4 left-[12%] md:left-[20%]',
  ];
  return (
    <>
      {CALLOUTS.map((c, i) => (
        <motion.div
          key={c.text}
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5, delay: i * 0.25, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute ${positions[i]} max-w-[15rem] md:max-w-xs`}
        >
          <div className="flex items-center gap-3 rounded-xl bg-white shadow-lg shadow-black/10 border border-black/5 px-4 py-3">
            <span className="w-8 h-8 rounded-lg bg-[#0d9488]/10 flex items-center justify-center shrink-0">
              <c.icon size={15} className="text-[#0d9488]" />
            </span>
            <p className="text-[13px] leading-snug text-[#14261f]">{c.text}</p>
          </div>
        </motion.div>
      ))}
    </>
  );
}

export function ValueBand() {
  return (
    <section className="relative bg-[#fbfaf6] pt-24 pb-4 md:pt-32 overflow-hidden">
      <Reveal className="relative max-w-3xl mx-auto px-6 text-center">
        <h2 className="font-display text-3xl md:text-5xl font-medium text-[#14261f] leading-[1.1] tracking-tight">
          Outcomes<IconChip icon={ClipboardCheck} />you can measure, calls that are real-world ready
        </h2>
      </Reveal>

      <div className="relative mt-16 md:mt-20 h-[26rem] md:h-[32rem] max-w-4xl mx-auto">
        <MorphingBlob />
        <CalloutCards />
      </div>

      <Wave fill="#ffffff" />
    </section>
  );
}
