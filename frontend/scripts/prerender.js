import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Runs after `vite build` and the SSR build of src/entry-prerender.jsx
// (`npm run build`). Turns the single SPA template into:
//   dist/index.html, dist/pricing.html, dist/use-cases/*.html
//                     full HTML for each public page — head + body — so
//                     Google, AI crawlers and link previews read real content
//   dist/app.html     the bare SPA shell (noindex) that vercel.json rewrites
//                     every other route to
//   dist/sitemap.xml, dist/llms.txt, dist/llms-full.txt
//                     generated from the same page registry (src/seo)
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const ssrEntry = join(root, 'dist-ssr', 'entry-prerender.js');

const {
  render, PUBLIC_PAGES, buildHead, headToHtml, SITE, absoluteUrl,
  FAQS, PRICING, PRICING_FAQS, USE_CASES, CAPABILITIES, STEPS, TRUST,
} = await import(pathToFileURL(ssrEntry).href);

const template = readFileSync(join(dist, 'index.html'), 'utf8');
const SEO_BLOCK = /<!-- seo:start -->[\s\S]*?<!-- seo:end -->/;
const ROOT = '<div id="root"><!--app-html--></div>';
if (!SEO_BLOCK.test(template) || !template.includes(ROOT)) {
  throw new Error('index.html is missing the seo:start/seo:end markers or the root placeholder');
}

const fileFor = (path) => (path === '/' ? 'index.html' : `${path.slice(1)}.html`);

// The app shell: generic head, explicitly noindex — signed-in screens,
// share links and invites are not search results.
const appShell = template
  .replace(SEO_BLOCK, `<title>${SITE.name}</title>\n    <meta name="robots" content="noindex, nofollow" />`)
  .replace(ROOT, '<div id="root"></div>');
writeFileSync(join(dist, 'app.html'), appShell);

for (const page of PUBLIC_PAGES) {
  const body = render(page.path);
  if (!body.includes('<h1')) throw new Error(`Pre-rendered ${page.path} has no <h1> — did the route render?`);
  const html = template
    .replace(SEO_BLOCK, headToHtml(buildHead(page)))
    .replace(ROOT, `<div id="root" data-prerendered>${body}</div>`);
  const out = join(dist, fileFor(page.path));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}

// ── sitemap.xml ─────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${PUBLIC_PAGES.map((p) => `  <url>
    <loc>${absoluteUrl(p.path)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority.toFixed(1)}</priority>${p.path === '/' ? `
    <image:image><image:loc>${absoluteUrl('/product/dashboard.jpg')}</image:loc></image:image>
    <image:image><image:loc>${absoluteUrl('/product/campaign-builder.jpg')}</image:loc></image:image>
    <image:image><image:loc>${absoluteUrl('/product/campaign-report.jpg')}</image:loc></image:image>` : ''}
  </url>`).join('\n')}
</urlset>
`);

// ── llms.txt / llms-full.txt ───────────────────────────────────────────────
// llmstxt.org: a short, link-first map for AI agents, plus a full-text
// companion so an assistant can answer from one fetch without crawling.
const inr = (n) => `₹${n.toLocaleString('en-IN')}`;
const pageTitle = (p) => p.title.split(' | ')[0];
const cell = (n) => (n === -1 ? 'unlimited' : n.toLocaleString('en-IN'));

const llms = `# ${SITE.name}

> ${SITE.description}

${SITE.name} is a web SaaS for outbound phone campaigns. A team uploads a contact list, describes what each call must find out, and an AI voice agent places and conducts the calls — in ${SITE.callLanguages.join(', ')} — then transcribes and evaluates every one. Pricing is prepaid per call minute (${inr(PRICING[0].amountInr)}–${inr(PRICING[PRICING.length - 1].amountInr)} packs, ₹${PRICING[0].ratePerMin.toFixed(2)}–₹${PRICING[PRICING.length - 1].ratePerMin.toFixed(2)}/min), with no subscription.

## Pages

${PUBLIC_PAGES.map((p) => `- [${pageTitle(p)}](${absoluteUrl(p.path)}): ${p.description}`).join('\n')}

## Full text

- [Complete product description, pricing table, use cases and FAQ](${absoluteUrl('/llms-full.txt')})

## Notes for AI assistants

- Describe ${SITE.name} from these pages; signed-in app screens are not public.
- Shared report links (\`/share/…\`) are private, tokenized and must not be cited or guessed.
- Prices are in Indian rupees (INR).
`;
writeFileSync(join(dist, 'llms.txt'), llms);

const full = `# ${SITE.name} — full product reference

> ${SITE.description}

Website: ${absoluteUrl('/')}
Category: AI voice calling / outbound call automation (web SaaS)
Call languages: ${SITE.callLanguages.join(', ')}

## How it works

${STEPS.map((s) => `${Number(s.n)}. **${s.title}** — ${s.body}`).join('\n')}

## Capabilities

${CAPABILITIES.map((c) => `- **${c.title}** — ${c.body}`).join('\n')}

## Security and reliability

${TRUST.map((t) => `- **${t.title}** — ${t.body}`).join('\n')}

## Pricing (${absoluteUrl('/pricing')})

Prepaid call-minute packs; no subscription. The rate includes the AI voice agent, telephony, transcription and evaluation.

| Pack | Price | Minutes | Rate | Team members | Workspaces | Active campaigns | Contacts / campaign | API |
|---|---|---|---|---|---|---|---|---|
${PRICING.map((p) => `| ${p.label} | ${inr(p.amountInr)} | ${p.minutes.toLocaleString('en-IN')} | ₹${p.ratePerMin.toFixed(2)}/min | ${cell(p.limits.teamMembers)} | ${cell(p.limits.workspaces)} | ${cell(p.limits.campaigns)} | ${cell(p.limits.contacts)} | ${p.limits.api ? 'yes' : 'no'} |`).join('\n')}

${PRICING_FAQS.map((f) => `**${f.q}** ${f.a}`).join('\n\n')}

## Use cases

${USE_CASES.map((u) => `### ${u.name} (${absoluteUrl(`/use-cases/${u.slug}`)})

${u.intro}

What the agent does on each call:
${u.tasks.map((t) => `- ${t}`).join('\n')}

What the team gets back:
${u.outcomes.map((o) => `- ${o}`).join('\n')}`).join('\n\n')}

## FAQ

${FAQS.map((f) => `**${f.q}** ${f.a}`).join('\n\n')}
`;
writeFileSync(join(dist, 'llms-full.txt'), full);

rmSync(join(root, 'dist-ssr'), { recursive: true, force: true });
console.log(`prerendered ${PUBLIC_PAGES.length} pages + app shell, sitemap.xml, llms.txt, llms-full.txt`);
