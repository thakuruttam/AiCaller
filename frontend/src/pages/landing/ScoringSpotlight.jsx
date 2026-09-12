import React from 'react';
import { User, Bot } from 'lucide-react';
import { Reveal, Wave } from './primitives';

function TranscriptPanel() {
  return (
    <div className="rounded-2xl bg-[#0f2d28] border border-white/10 p-6 md:p-8">
      <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 mb-6">
        <span className="w-1.5 h-1.5 rounded-full bg-[#5eead4]" />
        <span className="text-xs font-semibold text-slate-200">Salary Expectations Example</span>
      </span>

      <div className="space-y-4">
        <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white/5 px-4 py-3">
          <p className="text-sm text-slate-200 leading-relaxed">
            Honestly, I was hoping for something a bit higher than what's usually offered for this role.
          </p>
        </div>
        <div className="flex items-center gap-2 pl-1">
          <User size={13} className="text-slate-500" />
          <span className="text-xs text-slate-500">Candidate</span>
        </div>

        <div className="max-w-[85%] ml-auto rounded-xl rounded-tr-sm bg-[#0d9488]/20 px-4 py-3">
          <p className="text-sm text-slate-100 leading-relaxed">
            That's fair — can you share the range you had in mind? I'll note it and flag it for the recruiter alongside your other answers.
          </p>
        </div>
        <div className="flex items-center gap-2 justify-end pr-1">
          <span className="text-xs text-slate-500">AI Agent</span>
          <Bot size={13} className="text-slate-500" />
        </div>
      </div>
    </div>
  );
}

export function ScoringSpotlight() {
  return (
    <section className="relative bg-[#0a0f1a] py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true">
        <div className="absolute bottom-0 left-0 w-[28rem] h-[28rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.12) 0%, transparent 70%)' }} />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
        <Reveal>
          <div className="flex items-center gap-1.5 mb-6" aria-hidden="true">
            <span className="w-2 h-2 rounded-full bg-white/20" />
            <span className="w-2 h-2 rounded-full bg-[#0d9488]" />
            <span className="w-2 h-2 rounded-full bg-white/20" />
          </div>

          <h2 className="font-display text-3xl md:text-4xl font-medium text-white leading-[1.15] tracking-tight">
            Semantic answer scoring
          </h2>
          <p className="mt-5 text-base text-slate-400 leading-relaxed max-w-md">
            Describe what a good answer looks like in plain English — no regex, no rigid keyword rules. The AI reads intent, not just words.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <TranscriptPanel />
        </Reveal>
      </div>

      <Wave fill="#f8fafc" />
    </section>
  );
}
