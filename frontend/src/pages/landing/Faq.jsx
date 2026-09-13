import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQS } from './data';
import { Reveal } from './primitives';

function FaqItem({ item, isOpen, onToggle, id }) {
  return (
    <div className="border-b border-[#e2e8f0]">
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={`${id}-panel`}
          id={`${id}-button`}
          className="w-full flex items-center justify-between gap-4 py-5 text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488] rounded-lg"
        >
          <span className="text-sm font-semibold text-[#0f172a]">{item.q}</span>
          <ChevronDown size={18} className={`text-[#64748b] shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h3>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-button`}
        className={`grid transition-all duration-200 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100 pb-5' : 'grid-rows-[0fr] opacity-0'}`}
        style={{ display: 'grid' }}
      >
        <div className="overflow-hidden">
          <p className="text-sm text-[#64748b] leading-relaxed pr-8">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

export function Faq() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="relative bg-white py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-6">
        <Reveal className="text-center mb-12">
          <p className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="font-display text-3xl md:text-4xl font-normal text-[#0f172a] tracking-tight">
            Frequently asked questions
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          {FAQS.map((item, i) => (
            <FaqItem
              key={item.q}
              id={`faq-${i}`}
              item={item}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? -1 : i)}
            />
          ))}
        </Reveal>
      </div>
    </section>
  );
}
