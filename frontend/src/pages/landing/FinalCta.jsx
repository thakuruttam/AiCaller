import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Reveal } from './primitives';

export function FinalCta() {
  return (
    <section className="bg-[#0a0f1a] py-20 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.14) 0%, transparent 70%)' }} />
      </div>
      <Reveal className="relative max-w-3xl mx-auto px-6 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-normal text-white tracking-tight">
          Ready to put outbound calling on autopilot?
        </h2>
        <p className="mt-4 text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
          Sign in to launch your first AI voice campaign and see every call scored and reported in real time.
        </p>
        <div className="mt-8">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] transition-colors px-7 py-3.5 rounded-xl cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5eead4]"
          >
            Get started
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
