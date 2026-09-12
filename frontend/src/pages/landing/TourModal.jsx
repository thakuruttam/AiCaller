import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { TOUR_STEPS } from './data';

// See Hero.jsx for why this alias exists (eslint doesn't see `<MotionDiv>`
// member-expression JSX as a use of the `motion` import).
const MotionDiv = motion.div;

function Frame({ step }) {
  const [broken, setBroken] = useState(false);

  // Real screenshots land in /public/screenshots/*.png (see data.js). Until
  // they're captured from the live app, a missing image falls back to a
  // labeled placeholder instead of a broken-image icon.
  if (broken) {
    return (
      <div className="w-full aspect-video rounded-xl bg-gradient-to-br from-[#0f1729] to-[#0a0f1a] border border-white/10 flex flex-col items-center justify-center gap-2 text-slate-500">
        <ImageOff size={28} />
        <span className="text-xs">Screenshot coming soon</span>
      </div>
    );
  }

  return (
    <img
      src={step.image}
      alt={step.title}
      onError={() => setBroken(true)}
      className="w-full aspect-video object-cover rounded-xl border border-white/10 bg-[#0a0f1a]"
    />
  );
}

export function TourModal({ open, onClose }) {
  const [index, setIndex] = useState(0);
  // Resetting to the first frame each time the modal opens is a render-time
  // state adjustment (React's own recommended pattern for "reset state when
  // a prop changes"), not a side effect — doing it inside useEffect instead
  // would fire after the open-render already committed, causing an extra
  // cascading re-render just to flip back to frame 0.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setIndex(0);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex(i => Math.min(i + 1, TOUR_STEPS.length - 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const step = TOUR_STEPS[index];
  const isFirst = index === 0;
  const isLast = index === TOUR_STEPS.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Product tour"
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          <MotionDiv
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-2xl rounded-2xl bg-[#0f1729] border border-white/10 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Product tour · {index + 1} of {TOUR_STEPS.length}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close tour"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 md:p-6">
              <AnimatePresence mode="wait">
                <MotionDiv
                  key={index}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.25 }}
                >
                  <Frame step={step} />
                  <h3 className="mt-5 font-display text-lg font-semibold text-white">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">{step.body}</p>
                </MotionDiv>
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIndex(i => Math.max(i - 1, 0))}
                disabled={isFirst}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} />
                Back
              </button>

              <div className="flex items-center gap-1.5">
                {TOUR_STEPS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Go to step ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${i === index ? 'w-5 bg-[#0d9488]' : 'w-1.5 bg-white/20 hover:bg-white/40'}`}
                  />
                ))}
              </div>

              {isLast ? (
                <a
                  href="/login"
                  className="text-sm font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] transition-colors px-4 py-2 rounded-lg cursor-pointer"
                >
                  Get started
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setIndex(i => Math.min(i + 1, TOUR_STEPS.length - 1))}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
}
