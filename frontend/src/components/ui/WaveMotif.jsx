import React from 'react';

// Decorative voice waveform — the product's visual signature, shared by the
// marketing site (hero backdrops, dividers, CTA bands, footer) and the app
// (empty states, sign-in panel). Same bar language as WaveLoader, but wide
// and purely ornamental: aria-hidden, no layout of its own beyond its box.
//
// Bar heights come from a deterministic blend of sines, so the shape reads
// as speech (clusters and pauses) and is identical on the server and in the
// browser — no random values to differ between pre-render and client.
function heights(count, seed) {
  return Array.from({ length: count }, (_, i) => {
    const x = i / count;
    const envelope = Math.sin(Math.PI * x) ** 0.6;
    const voice =
      0.55 * Math.abs(Math.sin(i * 0.9 + seed)) +
      0.3 * Math.abs(Math.sin(i * 0.37 + seed * 2)) +
      0.15 * Math.abs(Math.sin(i * 2.1 + seed * 3));
    return Math.max(0.08, Math.min(1, envelope * voice * 1.25));
  });
}

export default function WaveMotif({
  bars = 64,
  height = 48,
  barWidth = 3,
  gap = 3,
  seed = 1,
  animated = false,
  className = '',
}) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none inline-flex items-center ${className}`}
      style={{ height, gap }}
    >
      {heights(bars, seed).map((h, i) => (
        <span
          key={i}
          className={`block shrink-0 rounded-full bg-current ${animated ? 'voice-wave-bar' : ''}`}
          style={{
            width: barWidth,
            height: animated ? '100%' : `${Math.round(h * 100)}%`,
            '--wave-rest': h,
            '--wave-peak': h,
            animationDelay: animated ? `${(i % 12) * 90}ms` : undefined,
            animationDuration: animated ? `${1.1 + (i % 5) * 0.18}s` : undefined,
          }}
        />
      ))}
    </span>
  );
}
