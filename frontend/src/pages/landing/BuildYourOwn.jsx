import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, User, FileText, Check } from 'lucide-react';
import { Reveal } from './primitives';

const MotionDiv = motion.div;

const TABS = {
  questions: {
    label: 'Questions',
    description: 'Add every question your campaign needs to ask, in plain English — branching logic and follow-ups included, no script writing required.',
    pills: [
      { icon: MessageSquare, label: 'Question Added' },
      { icon: FileText, label: 'Branching Rule' },
    ],
  },
  scoring: {
    label: 'Scoring',
    description: 'Describe what a good answer looks like, and weight it however you want — the AI judges every response against your own rubric.',
    pills: [
      { icon: User, label: 'Scoring Weight' },
      { icon: Check, label: 'Semantic Match' },
    ],
  },
};

// Dashed hexagon-ish outline, matching the decorative background motif used
// elsewhere on the reference site — built as plain SVG, not a copied image.
function DashedHex() {
  return (
    <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full" aria-hidden="true">
      <polygon
        points="200,20 360,110 360,290 200,380 40,290 40,110"
        fill="none"
        stroke="#0d9488"
        strokeOpacity="0.25"
        strokeDasharray="6 6"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function GeneratingCard() {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 rounded-xl bg-white border border-black/5 shadow-xl shadow-black/10 p-5">
      <p className="text-sm font-semibold text-[#14261f]">Generating campaign…</p>
      <div className="mt-3 flex gap-1" aria-hidden="true">
        {[0, 1, 2].map(i => (
          <MotionDiv
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#0d9488]"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </div>
  );
}

export function BuildYourOwn() {
  const [tab, setTab] = useState('questions');
  const active = TABS[tab];

  return (
    <section className="relative bg-white py-24 md:py-32">
      <div className="max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        <Reveal>
          <div className="flex items-center gap-2.5 mb-6">
            <span className="w-2 h-2 rounded-sm bg-amber-500" aria-hidden="true" />
            <span className="text-sm text-[#5b6158]">AiCaller Studio: No-Code Campaign Builder</span>
          </div>

          <h2 className="font-display text-3xl md:text-4xl font-medium text-[#14261f] leading-[1.15] tracking-tight">
            Build your own campaign logic — in just minutes
          </h2>

          <div className="mt-8 inline-flex rounded-full border border-[#e7e5e0] p-1">
            {Object.entries(TABS).map(([key, t]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors cursor-pointer ${
                  tab === key ? 'bg-[#14261f] text-white' : 'text-[#4b5148] hover:text-[#14261f]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="mt-6 text-base text-[#5b6158] leading-relaxed max-w-md"
            >
              {active.description}
            </motion.p>
          </AnimatePresence>
        </Reveal>

        <div className="relative h-[22rem] md:h-[26rem]">
          <DashedHex />
          <GeneratingCard />
          {active.pills.map((p, i) => (
            <motion.div
              key={`${tab}-${p.label}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.15 }}
              className={`absolute inline-flex items-center gap-2 rounded-full bg-[#14261f] text-white pl-2 pr-3 py-1.5 shadow-lg ${
                i === 0 ? 'left-[8%] top-[16%]' : 'right-[6%] bottom-[20%]'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white/15 flex items-center justify-center">
                <p.icon size={11} />
              </span>
              <span className="text-xs font-medium whitespace-nowrap">{p.label}</span>
              <Check size={13} className="text-[#5eead4]" />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
