import React from 'react';

// The app's one loading indicator: a voice waveform whose bars pulse like a
// live call's audio level — on brand for a calling product, and recognisable
// at every size from a button's 14px to a full-screen boot. Bars take
// `currentColor`, so it inherits the surrounding text colour (white inside a
// primary button, brand blue on a page). Under prefers-reduced-motion the
// bars hold a static waveform shape instead of animating (index.css).
const SIZES = {
  xs: { h: 14, bar: 2, gap: 2, bars: 4 },
  sm: { h: 18, bar: 3, gap: 2, bars: 4 },
  md: { h: 28, bar: 4, gap: 3, bars: 5 },
  lg: { h: 44, bar: 5, gap: 4, bars: 5 },
  xl: { h: 64, bar: 7, gap: 5, bars: 7 },
};

// Resting heights (as a fraction of full height) — the shape shown with
// reduced motion and the base each bar animates from, so the loader reads as
// a waveform even in its first frame.
const SHAPE = [0.45, 0.8, 1, 0.65, 0.9, 0.55, 0.75];

export default function WaveLoader({ size = 'md', label = 'Loading', className = '' }) {
  const s = typeof size === 'number'
    ? { h: size, bar: Math.max(2, Math.round(size / 7)), gap: Math.max(1, Math.round(size / 9)), bars: size < 20 ? 4 : 5 }
    : SIZES[size] ?? SIZES.md;

  return (
    <span
      role="status"
      aria-label={label}
      className={`voice-wave inline-flex items-center ${className}`}
      style={{ height: s.h, gap: s.gap }}
    >
      {Array.from({ length: s.bars }).map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="voice-wave-bar block rounded-full bg-current"
          style={{
            width: s.bar,
            height: '100%',
            '--wave-rest': SHAPE[i % SHAPE.length],
            animationDelay: `${i * 110}ms`,
          }}
        />
      ))}
    </span>
  );
}
