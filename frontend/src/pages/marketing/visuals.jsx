import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { TONES, TONE_CYCLE } from './tones';

// Visual building blocks for the public site. Everything here renders its
// full content on the server (pre-render) and without JavaScript — motion is
// layered on top in the browser, never required to read the page.

export function IconTile({ icon, tone = 'blue', size = 'md', className = '' }) {
  const box = size === 'lg' ? 'size-12 rounded-2xl [--icon-size:24px]' : 'size-10 rounded-xl [--icon-size:20px]';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ring-1 ring-inset ${TONES[tone] ?? TONES.blue} ${box} ${className}`}>
      <span className="material-symbols-outlined" aria-hidden="true">{icon}</span>
    </span>
  );
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Runs `onEnter` once the element scrolls into view.
function useInView(onEnter, rootMargin = '0px 0px -12% 0px') {
  const ref = useRef(null);
  const fired = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || fired.current) return undefined;
    if (!('IntersectionObserver' in window)) {
      fired.current = true;
      onEnter();
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !fired.current) {
        fired.current = true;
        onEnter();
        io.disconnect();
      }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
    // onEnter is a fresh closure each render; it only matters the first time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootMargin]);
  return ref;
}

// Fades and lifts its content in as it scrolls into view. The hidden state
// only applies under `html.js` (set by index.html), so pre-rendered HTML read
// without JavaScript is never invisible.
export function Reveal({ as: asProp = 'div', delay = 0, className = '', children, ...props }) {
  const As = asProp;
  const [shown, setShown] = useState(false);
  const ref = useInView(() => setShown(true));
  return (
    <As
      ref={ref}
      data-reveal={shown ? 'in' : 'out'}
      style={{ '--reveal-delay': `${delay}ms` }}
      className={className}
      {...props}
    >
      {children}
    </As>
  );
}

// ── Example call ────────────────────────────────────────────────────────────
// An illustrative screening call that plays out turn by turn and ends with
// the evaluation the product produces. Labelled as an example on screen — it
// demonstrates the flow, it is not a customer recording.
const CALL = [
  { who: 'agent', text: 'Hi Priya, this is the hiring team calling about the Backend Engineer role. Is now a good time for two minutes?' },
  { who: 'contact', text: 'Yes, go ahead.' },
  { who: 'agent', text: 'Thanks! What is your current notice period?' },
  { who: 'contact', text: 'Thirty days — but it is negotiable.' },
  { who: 'agent', text: 'Got it. And what compensation are you expecting for this role?' },
  { who: 'contact', text: 'Around twenty-four lakhs.' },
];
const EVALUATION = [
  { label: 'Outcome', value: 'Completed', tone: 'emerald' },
  { label: 'Sentiment', value: 'Positive', tone: 'sky' },
  { label: 'Score', value: '86 / 100', tone: 'violet' },
];

export function CallDemo({ className = '' }) {
  // The server renders the whole conversation (readable without JS); in the
  // browser it restarts from the first line once it scrolls into view.
  const [step, setStep] = useState(() => (typeof window === 'undefined' ? CALL.length + 1 : 1));
  const [running, setRunning] = useState(false);
  const ref = useInView(() => {
    if (prefersReducedMotion()) setStep(CALL.length + 1);
    else setRunning(true);
  });

  useEffect(() => {
    if (!running) return undefined;
    const done = step > CALL.length;
    const t = setTimeout(() => setStep((s) => (done ? 1 : s + 1)), done ? 4200 : 1500);
    return () => clearTimeout(t);
  }, [running, step]);

  const lines = CALL.slice(0, Math.min(step, CALL.length));
  const evaluated = step > CALL.length;

  return (
    <figure ref={ref} className={`overflow-hidden rounded-2xl border border-paper-500 bg-paper-100 shadow-[0_24px_60px_-28px_rgba(16,24,40,0.35)] ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-paper-500 bg-paper-200 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[13px] font-semibold text-ink-100">{evaluated ? 'Call ended' : 'Live call'}</span>
          <span className="text-[13px] text-ink-700">· HR screening</span>
        </div>
        <span className="rounded-full bg-paper-100 px-2 py-0.5 text-[11px] font-medium text-ink-700 ring-1 ring-paper-500">Example call</span>
      </div>

      <div className="min-h-[300px] space-y-3 p-4" aria-live="off">
        {lines.map((l, i) => (
          <div key={i} className={`flex animate-rise ${l.who === 'agent' ? 'justify-start' : 'justify-end'}`}>
            <p
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                l.who === 'agent' ? 'rounded-tl-sm bg-blue-50 text-ink-100' : 'rounded-tr-sm bg-paper-300 text-ink-100'
              }`}
            >
              <span className="mb-0.5 block text-[11px] font-semibold text-ink-700">{l.who === 'agent' ? 'AI agent' : 'Priya'}</span>
              {l.text}
            </p>
          </div>
        ))}
        {!evaluated && step <= CALL.length && running && (
          <div className="flex items-center gap-1 pl-1 text-blue-500" aria-hidden="true">
            {[0, 1, 2, 3].map((b) => (
              <span key={b} className="voice-wave-bar block h-4 w-1 rounded-full bg-current" style={{ animationDelay: `${b * 110}ms` }} />
            ))}
          </div>
        )}
      </div>

      <figcaption className={`grid grid-cols-3 gap-px border-t border-paper-500 bg-paper-500 transition-opacity duration-500 ${evaluated ? 'opacity-100' : 'opacity-40'}`}>
        {EVALUATION.map((e) => (
          <div key={e.label} className="bg-paper-100 px-4 py-3">
            <p className="text-[11px] font-medium text-ink-700">{e.label}</p>
            <p className={`mt-0.5 text-sm font-semibold ${TONES[e.tone].split(' ')[1]}`}>{evaluated ? e.value : '—'}</p>
          </div>
        ))}
      </figcaption>
    </figure>
  );
}

// ── Stats band ──────────────────────────────────────────────────────────────
// Product facts only (voices, languages, campaign types, code required) —
// counted up once on view.
function CountUp({ to, duration = 1200 }) {
  const [n, setN] = useState(to);
  const ref = useInView(() => {
    if (prefersReducedMotion() || to === 0) return;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      setN(Math.round(to * (1 - (1 - p) ** 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    setN(0);
    requestAnimationFrame(tick);
  });
  return <span ref={ref} className="tabular-nums">{n}</span>;
}

export function StatsBand({ stats }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-paper-500 bg-paper-500 md:grid-cols-4">
      {stats.map((s, i) => (
        <Reveal key={s.label} delay={i * 80} className="bg-paper-100 px-6 py-7">
          <dt className="sr-only">{s.label}</dt>
          <dd>
            <IconTile icon={s.icon} tone={s.tone} />
            <p className="mt-4 text-4xl font-bold tracking-tight text-ink-100"><CountUp to={s.value} />{s.suffix}</p>
            <p className="mt-1 text-sm text-ink-600">{s.label}</p>
          </dd>
        </Reveal>
      ))}
    </dl>
  );
}

// ── Demo video ──────────────────────────────────────────────────────────────
// Poster + play button until clicked, so the 1 MB video is only fetched by
// people who want it (preload="none").
export function DemoVideo({ src, poster, title }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const play = () => {
    setPlaying(true);
    requestAnimationFrame(() => videoRef.current?.play());
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-100/10 bg-ink-50 shadow-[0_30px_70px_-28px_rgba(16,16,16,0.45)]">
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls={playing}
        preload="none"
        playsInline
        width={1280}
        height={720}
        className="block aspect-video h-auto w-full"
        aria-label={title}
      />
      {!playing && (
        <button
          type="button"
          onClick={play}
          className="group absolute inset-0 flex cursor-pointer items-center justify-center bg-ink-50/25 outline-none transition-colors hover:bg-ink-50/15 focus-visible:ring-4 focus-visible:ring-white/60"
          aria-label={`Play video: ${title}`}
        >
          <span className="flex size-20 items-center justify-center rounded-full bg-paper-100 text-blue-600 shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-transform duration-200 group-hover:scale-105">
            <span className="material-symbols-outlined [--icon-size:40px]" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
          </span>
          <span className="absolute bottom-4 left-4 rounded-full bg-ink-50/70 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {title} · 0:56
          </span>
        </button>
      )}
    </div>
  );
}

// ── Flow steps ──────────────────────────────────────────────────────────────
// The four steps as a connected flow: tinted tiles joined by a dashed line
// that draws itself across on wide screens.
export function FlowSteps({ steps }) {
  return (
    <ol className="relative grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      <span aria-hidden="true" className="flow-line pointer-events-none absolute left-[12%] right-[12%] top-6 hidden h-px lg:block" />
      {steps.map((s, i) => (
        <Reveal as="li" key={s.n} delay={i * 120} className="relative">
          <IconTile icon={s.icon} tone={s.tone} size="lg" className="relative z-10 outline outline-[6px] outline-paper-100" />
          <p className="mt-5 text-[13px] font-semibold tabular-nums text-ink-700">Step {Number(s.n)}</p>
          <h3 className="mt-1 text-[17px] font-semibold tracking-[-0.01em] text-ink-100">{s.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">{s.body}</p>
        </Reveal>
      ))}
    </ol>
  );
}

// ── Use-case strip ──────────────────────────────────────────────────────────
export function UseCaseStrip({ useCases }) {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-2.5">
      {useCases.map((u, i) => (
        <li key={u.slug}>
          <Link
            to={`/use-cases/${u.slug}`}
            className="inline-flex items-center gap-2 rounded-full border border-paper-500 bg-paper-100 py-1.5 pl-1.5 pr-4 text-sm font-medium text-ink-100 shadow-xs transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-paper-800"
          >
            <IconTile icon={u.icon} tone={TONE_CYCLE[i % TONE_CYCLE.length]} className="!size-7 !rounded-full [--icon-size:15px]" />
            {u.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
