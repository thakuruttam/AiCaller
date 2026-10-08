import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { collectIconNames, requestedIconNames } from '../scripts/icon-names.js';

// index.html requests a Material Symbols subset of only the icons in use.
// An icon missing from that list renders as its ligature text ("expand_more")
// instead of a glyph — so a new icon must come with `npm run icons:sync`.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('Material Symbols subset', () => {
  it('index.html requests every icon referenced in src/', () => {
    const requested = requestedIconNames(readFileSync(join(root, 'index.html'), 'utf8'));
    expect(requested, 'index.html has no icon_names= list').not.toBeNull();
    const missing = collectIconNames(join(root, 'src')).filter((n) => !requested.includes(n));
    expect(missing, 'run `npm run icons:sync` to add these to index.html').toEqual([]);
  });
});
