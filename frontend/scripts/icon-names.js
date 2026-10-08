import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Finds every Material Symbols glyph the app references, so index.html can
// request a font subset of just those (icon_names=) instead of the full
// ~300 KB icon font. Matches the ways icons are named in this codebase:
//   icon="x" / iconRight="x" / icon={cond ? 'x' : 'y'}   (Button, Input, Th, EmptyState…)
//   icon: 'x'                                            (data/meta objects)
//   <span className="material-symbols-outlined …">x</span>, incl. {cond ? 'x' : 'y'}
//   const SENTIMENT_ICON = { positive: 'x', … }           (lookup maps named *_ICON / *_ICONS)
// A string that isn't really an icon only costs a few bytes in the request;
// a missed one renders as plain text, so the patterns err towards matching.
const SRC_EXT = /\.(jsx?|tsx?)$/;
const NAME = /^[a-z][a-z0-9_]*$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (SRC_EXT.test(entry) && !/\.test\./.test(entry)) out.push(p);
  }
  return out;
}

const quoted = (text) => [...text.matchAll(/(['"`])([a-z][a-z0-9_]*)\1/g)].map((m) => m[2]);

export function collectIconNames(srcDir) {
  const names = new Set();
  for (const file of walk(srcDir)) {
    const s = readFileSync(file, 'utf8');
    for (const m of s.matchAll(/\b(?:icon|iconRight|iconName)\s*=\s*"([^"]+)"/g)) names.add(m[1]);
    for (const m of s.matchAll(/\b(?:icon|iconRight|iconName)\s*=\s*\{([^}]*)\}/g)) quoted(m[1]).forEach((n) => names.add(n));
    for (const m of s.matchAll(/\b(?:icon|iconName)\s*:\s*(['"])([a-z][a-z0-9_]*)\1/g)) names.add(m[2]);
    for (const m of s.matchAll(/\b[A-Z][A-Z_]*_ICONS?\s*=\s*\{([^}]*)\}/g)) quoted(m[1]).forEach((n) => names.add(n));
    for (const m of s.matchAll(/material-symbols-outlined[^>]*>([^<]*)</g)) {
      const text = m[1].trim();
      if (NAME.test(text)) names.add(text);
      else if (text.startsWith('{')) quoted(text).forEach((n) => names.add(n));
    }
  }
  return [...names].filter((n) => NAME.test(n)).sort();
}

// The icon_names list currently requested by index.html.
export function requestedIconNames(indexHtml) {
  const m = indexHtml.match(/Material\+Symbols\+Outlined[^"]*?icon_names=([a-z0-9_,]+)/);
  return m ? m[1].split(',') : null;
}
