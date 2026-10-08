import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { collectIconNames } from './icon-names.js';

// Rewrites the icon_names= list in index.html from the icons used in src/.
// Run after adding a new icon: `npm run icons:sync`.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = join(root, 'index.html');
const names = collectIconNames(join(root, 'src'));
const html = readFileSync(indexPath, 'utf8');
const next = html.replace(
  /(Material\+Symbols\+Outlined[^"]*?)(&icon_names=[a-z0-9_,]+)?(&display=block")/,
  `$1&icon_names=${names.join(',')}$3`,
);
if (next === html) {
  console.log(`icon subset already up to date (${names.length} icons)`);
} else {
  writeFileSync(indexPath, next);
  console.log(`icon subset updated: ${names.length} icons`);
}
