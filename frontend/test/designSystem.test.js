import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

// Enforces the "Design system rules" block in src/index.css, so a screen
// can't quietly reintroduce one-off colours, greys, overlays or spacing. Each
// failure lists file:line so the fix is a lookup, not a hunt.
//
// Out of scope: the marketing site and the dead landing page (their own
// art direction), the vendored web3-dashboard template demo, and tests.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const EXCLUDED = /^(pages\/(landing|marketing)\/|pages\/web3-dashboard\/|pages\/Landing\.jsx$|pages\/CampaignEvaluationReport\.jsx$)|\.test\./;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|tsx?)$/.test(entry)) out.push(p);
  }
  return out;
}

const files = walk(root)
  .map((p) => ({ path: relative(root, p), lines: readFileSync(p, 'utf8').split('\n') }))
  .filter((f) => !EXCLUDED.test(f.path));

// Lines a rule deliberately allows, as [file, line-substring].
function violations(pattern, allow = []) {
  const hits = [];
  for (const { path, lines } of files) {
    lines.forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (!pattern.test(line)) return;
      if (allow.some(([file, snippet]) => path === file && (!snippet || line.includes(snippet)))) return;
      hits.push(`${path}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
  return hits;
}

describe('design system', () => {
  it('uses brand and status colours only — no decorative Tailwind hues', () => {
    expect(violations(
      /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|from|to|via|fill|stroke|outline|divide|decoration|shadow)-(?:sky|emerald|orange|lime|purple|pink|indigo|violet|teal|cyan|amber|yellow|green|red|blue|rose|fuchsia|slate|gray|zinc|neutral|stone)-\d{2,3}\b/,
    )).toEqual([]);
  });

  it('has no hard-coded hex colours outside third-party brand marks', () => {
    expect(violations(/#[0-9a-fA-F]{6}\b/, [
      ['pages/Login.jsx'], // Google / Microsoft sign-in logos and the dark brand panel
      ['pages/InviteAccept.jsx'], // Google sign-in logo
      ['pages/Billing.jsx', 'color:'], // Razorpay checkout theme takes a hex
    ])).toEqual([]);
  });

  it('uses the two text roles instead of raw grey shades', () => {
    expect(violations(/(?<![\w:-])(?:dark:)?text-ink-[1-9]00\b/, [
      ['context/ToastContext.jsx'], // toasts are a dark tile in both themes
      ['pages/Login.jsx'], // dark brand panel
    ])).toEqual([]);
  });

  it('uses the one brand tint, border tint and solid accent', () => {
    expect(violations(
      // Resting colours only — hover/active steps of the tint are interaction
      // states, not new shades.
      /(?<![\w:-])(?:dark:)?(?:bg-brand-(?:50|100|200)\b|bg-brand-500\/(?:5|15|20|\[0\.\d+\])(?![\w])|border-brand-(?:100|200|300)\b)|(?<![\w-])dark:bg-brand-(?:500|600)\//,
    )).toEqual([]);
  });

  it('keeps layout spacing on the scale (sections 7, grids 5)', () => {
    expect(violations(/(?<![\w:-])(?:space-y|mb|mt|gap)-(?:8|9|10|11|12|14|16)\b/, [
      ['pages/Login.jsx'],
    ])).toEqual([]);
  });

  it('uses flat fills only — no gradients', () => {
    expect(violations(/bg-gradient-to-|(?<!\[background-image:)linear-gradient\(/)).toEqual([]);
  });

  it('opens dialogs through the shared Modal and confirm dialog', () => {
    expect(violations(/fixed inset-0/, [
      ['components/Modal.jsx'],
    ])).toEqual([]);
    expect(violations(/(?<![\w.])(?:window\.)?(?:confirm|alert)\(\s*['"`]/)).toEqual([]);
  });
});
