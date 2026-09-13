import React from 'react';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectFade } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-fade';
import { ClipboardCheck, Mic, ShieldCheck, PhoneCall } from 'lucide-react';
import { IconChip, Reveal } from './primitives';

const MotionDiv = motion.div;

// A continuously morphing organic blob (animated border-radius) with a static
// dashed outline echo behind it — the reference site's decorative background
// treatment. Pure CSS technique, not a copied asset.
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

// Captions auto-cycle over the blob via Swiper (the same carousel library the
// reference site itself uses — confirmed via its own `swiper-scrollbar`
// class), instead of a hand-rolled page-scroll hijack that added unwanted
// scroll length without the reference's actual cycling behavior.
export function ValueBand() {
  return (
    <section className="relative bg-[#fbfaf6] py-24 md:py-32 overflow-hidden">
      <Reveal className="max-w-3xl mx-auto px-6 text-center mb-16">
        <h2 className="font-display text-3xl md:text-5xl font-normal text-[#14261f] leading-[1.1] tracking-tight">
          Outcomes<IconChip icon={ClipboardCheck} />you can measure, calls that are real-world ready
        </h2>
      </Reveal>

      <div className="relative w-full max-w-4xl mx-auto h-[22rem] md:h-[26rem] px-6">
        <MorphingBlob />

        <Swiper
          modules={[Autoplay, EffectFade]}
          effect="fade"
          fadeEffect={{ crossFade: true }}
          autoplay={{ delay: 2600, disableOnInteraction: false }}
          loop
          className="relative h-full max-w-sm mx-auto flex items-center"
        >
          {CALLOUTS.map(c => (
            <SwiperSlide key={c.text} className="flex items-center justify-center">
              <div className="flex items-center gap-3 rounded-xl bg-white shadow-lg shadow-black/10 border border-black/5 px-4 py-3">
                <span className="w-8 h-8 rounded-lg bg-[#0d9488]/10 flex items-center justify-center shrink-0">
                  <c.icon size={15} className="text-[#0d9488]" />
                </span>
                <p className="text-[13px] leading-snug text-[#14261f]">{c.text}</p>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}
