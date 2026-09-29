import React from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import { User, Bot, Smile, GitBranch } from 'lucide-react';
import { Reveal } from './primitives';

function TranscriptMock() {
  return (
    <div className="space-y-4">
      <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-white/5 px-4 py-3">
        <p className="text-sm text-paper-200 leading-relaxed">
          Honestly, I was hoping for something a bit higher than what's usually offered for this role.
        </p>
      </div>
      <div className="flex items-center gap-2 pl-1">
        <User size={13} className="text-ink-700" />
        <span className="text-xs text-ink-700">Candidate</span>
      </div>
      <div className="max-w-[85%] ml-auto rounded-xl rounded-tr-sm bg-[#266df0]/20 px-4 py-3">
        <p className="text-sm text-paper-200 leading-relaxed">
          That's fair — can you share the range you had in mind? I'll flag it for the recruiter alongside your other answers.
        </p>
      </div>
      <div className="flex items-center gap-2 justify-end pr-1">
        <span className="text-xs text-ink-700">AI Agent</span>
        <Bot size={13} className="text-ink-700" />
      </div>
    </div>
  );
}

function SentimentMock() {
  return (
    <div className="space-y-3">
      {[
        { label: 'Enthusiasm', pct: 82, tone: '#94b9ff' },
        { label: 'Hesitation', pct: 24, tone: '#fbbf24' },
        { label: 'Clarity', pct: 91, tone: '#94b9ff' },
      ].map(m => (
        <div key={m.label}>
          <div className="flex items-center justify-between text-xs text-ink-800 mb-1.5">
            <span>{m.label}</span>
            <span className="text-paper-200 font-medium">{m.pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: m.tone }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function BranchingMock() {
  return (
    <div className="space-y-2.5">
      {[
        { label: 'Asked about notice period', state: 'done' },
        { label: '"2 weeks" → skip to salary', state: 'done' },
        { label: '"Immediate" → ask start date', state: 'active' },
      ].map((s, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.state === 'active' ? 'bg-[#94b9ff]' : 'bg-white/30'}`} />
          <span className="text-xs text-ink-900">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

const SLIDES = [
  {
    icon: null,
    title: 'Semantic answer scoring',
    body: 'Describe what a good answer looks like in plain English — no regex, no rigid keyword rules. The AI reads intent, not just words.',
    tag: 'Salary Expectations Example',
    Mock: TranscriptMock,
  },
  {
    icon: Smile,
    title: 'Sentiment & tone detection',
    body: 'Every call is scored for enthusiasm, hesitation, and clarity automatically — so you can spot a strong candidate before you even read the transcript.',
    tag: 'Sentiment Breakdown',
    Mock: SentimentMock,
  },
  {
    icon: GitBranch,
    title: 'Branching call flows',
    body: 'The conversation adapts to each answer in real time — skip a question, jump ahead, or end the call early based on what someone actually says.',
    tag: 'Live Branching',
    Mock: BranchingMock,
  },
];

export function ScoringSpotlight() {
  return (
    <section className="relative bg-[#101010] py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none opacity-40" aria-hidden="true">
        <div className="absolute bottom-0 left-0 w-[28rem] h-[28rem] rounded-full" style={{ background: 'radial-gradient(circle, rgba(38,109,240,0.12) 0%, transparent 70%)' }} />
      </div>

      <Reveal className="relative max-w-7xl mx-auto px-6">
        {/* A single, stable pagination container sitting outside the sliding
            track — required by Swiper's custom-pagination pattern, since a
            container rendered inside each slide would duplicate per slide
            and lose track of the other slides' dots. */}
        <div className="scoring-spotlight-dots flex items-center gap-1.5 mb-6" />

        <Swiper
          modules={[Autoplay, Pagination]}
          autoplay={{ delay: 4000, disableOnInteraction: false }}
          pagination={{ clickable: true, el: '.scoring-spotlight-dots' }}
          loop
          className="scoring-spotlight-swiper"
        >
          {SLIDES.map(s => (
            <SwiperSlide key={s.title}>
              <div className="grid lg:grid-cols-2 gap-16 items-center">
                <div>
                  <h2 className="font-display text-3xl md:text-4xl font-normal text-white leading-[1.15] tracking-tight">
                    {s.title}
                  </h2>
                  <p className="mt-5 text-base text-ink-800 leading-relaxed max-w-md">{s.body}</p>
                </div>

                <div className="rounded-2xl bg-[#0f2d28] border border-white/10 p-6 md:p-8">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#94b9ff]" />
                    <span className="text-xs font-semibold text-paper-200">{s.tag}</span>
                  </span>
                  <s.Mock />
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </Reveal>
    </section>
  );
}
