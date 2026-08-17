import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const destDir = path.resolve(__dirname, '../public/docs');

const sources = [
  { src: path.join(repoRoot, 'README.md'), dest: 'README.md' },
  { src: path.join(repoRoot, 'CLAUDE.md'), dest: 'CLAUDE.md' },
  { src: path.join(repoRoot, 'docs', 'ARCHITECTURE_REVIEW.md'), dest: 'ARCHITECTURE_REVIEW.md' },
];

fs.mkdirSync(destDir, { recursive: true });

for (const { src, dest } of sources) {
  fs.copyFileSync(src, path.join(destDir, dest));
}
