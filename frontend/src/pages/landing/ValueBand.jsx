import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ClipboardCheck, Mic, ShieldCheck, PhoneCall } from 'lucide-react';
import { IconChip, Reveal } from './primitives';

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
  { icon: PhoneCall, text: 'AI-powered call handling, designed for real-world conversation.', pos: 'top-4 left-[8%] md:left-[14%]' },
  { icon: Mic, text: 'Every call transcribed, live, with no manual note-taking.', pos: 'top-1/2 -translate-y-1/2 right-[4%] md:right-[10%]' },
  { icon: ShieldCheck, text: 'Role-based access, so the right people see the right calls.', pos: 'bottom-4 left-[12%] md:left-[20%]' },
];

// A true scroll-pinned sequence, not just a scroll-reveal: the headline and
// blob stay fixed in the viewport (`sticky`) while the section itself is
// several viewport-heights tall, and each caption's opacity is driven
// directly by scroll progress through that tall section — matching the
// reference site's own sticky-scroll cycling captions, not an approximation.
export function ValueBand() {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });

  const opacity0 = useTransform(scrollYProgress, [0.05, 0.15, 0.3, 0.4], [0, 1, 1, 0]);
  const opacity1 = useTransform(scrollYProgress, [0.35, 0.45, 0.6, 0.7], [0, 1, 1, 0]);
  const opacity2 = useTransform(scrollYProgress, [0.65, 0.75, 0.9, 1], [0, 1, 1, 0]);
  const opacities = [opacity0, opacity1, opacity2];

  return (
    <section ref={sectionRef} className="relative bg-[#fbfaf6]" style={{ height: '300vh' }}>
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden px-6">
        <Reveal className="max-w-3xl mx-auto text-center mb-4">
          <h2 className="font-display text-3xl md:text-5xl font-medium text-[#14261f] leading-[1.1] tracking-tight">
            Outcomes<IconChip icon={ClipboardCheck} />you can measure, calls that are real-world ready
          </h2>
        </Reveal>

        <div className="relative w-full max-w-4xl h-[28rem] md:h-[36rem]">
          <MorphingBlob />
          {CALLOUTS.map((c, i) => (
            <MotionDiv key={c.text} style={{ opacity: opacities[i] }} className={`absolute ${c.pos} max-w-[15rem] md:max-w-xs`}>
              <div className="flex items-center gap-3 rounded-xl bg-white shadow-lg shadow-black/10 border border-black/5 px-4 py-3">
                <span className="w-8 h-8 rounded-lg bg-[#0d9488]/10 flex items-center justify-center shrink-0">
                  <c.icon size={15} className="text-[#0d9488]" />
                </span>
                <p className="text-[13px] leading-snug text-[#14261f]">{c.text}</p>
              </div>
            </MotionDiv>
          ))}
        </div>
      </div>
    </section>
  );
}
