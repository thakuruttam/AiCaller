import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PUBLIC_PAGES, pageForPath } from '../src/seo/pages.js';
import { buildHead, headToHtml, applyHead } from '../src/seo/head.js';
import { PRICING, FAQ_GROUPS, NAV_LINKS } from '../src/pages/marketing/content.js';
import { MARKETING_ROUTES } from '../src/pages/marketing/routes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('public page SEO', () => {
  it.each(PUBLIC_PAGES.map((p) => [p.path, p]))('%s has a search-friendly title and description', (_, page) => {
    expect(page.title.length).toBeLessThanOrEqual(65);
    expect(page.description.length).toBeGreaterThanOrEqual(70);
    expect(page.description.length).toBeLessThanOrEqual(160);
  });

  it('every page has a unique path, title and description', () => {
    for (const key of ['path', 'title', 'description']) {
      const values = PUBLIC_PAGES.map((p) => p[key]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('FAQ structured data lives on /faq only and matches its visible questions word for word', () => {
    const faq = pageForPath('/faq').jsonLd.find((n) => n['@type'] === 'FAQPage');
    expect(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]))
      .toEqual(FAQ_GROUPS.flatMap((g) => g.items).map((f) => [f.q, f.a]));
    const others = PUBLIC_PAGES.filter((p) => p.path !== '/faq' && p.jsonLd.some((n) => n['@type'] === 'FAQPage'));
    expect(others.map((p) => p.path)).toEqual([]);
  });

  it('every nav link is a real page in the registry, not an in-page jump', () => {
    for (const link of NAV_LINKS) {
      expect(link.to, `${link.label} should be a page route`).toBeTruthy();
      expect(pageForPath(link.to), `${link.to} missing from PUBLIC_PAGES`).not.toBeNull();
    }
  });

  it('every public page has a route the app and pre-render share', () => {
    const routes = MARKETING_ROUTES.map((r) => r.path);
    for (const page of PUBLIC_PAGES) {
      const matches = routes.some((r) => r === page.path || (r.includes(':') && page.path.startsWith(r.split(':')[0])));
      expect(matches, `${page.path} has no route`).toBe(true);
    }
  });

  it('breadcrumb structured data mirrors the visible trail', () => {
    for (const page of PUBLIC_PAGES.filter((p) => p.breadcrumbs)) {
      const ld = page.jsonLd.find((n) => n['@type'] === 'BreadcrumbList');
      expect(ld.itemListElement.map((i) => i.name)).toEqual(page.breadcrumbs.map((b) => b.name));
    }
  });

  it('pageForPath ignores a trailing slash and returns null for app routes', () => {
    expect(pageForPath('/pricing/').path).toBe('/pricing');
    expect(pageForPath('/team')).toBeNull();
  });
});

describe('head rendering', () => {
  const page = pageForPath('/pricing');

  it('emits canonical, Open Graph, Twitter and JSON-LD tags', () => {
    const html = headToHtml(buildHead(page));
    expect(html).toContain('<link rel="canonical" href="https://aicaller.store/pricing" data-seo />');
    expect(html).toContain('property="og:url" content="https://aicaller.store/pricing"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toMatch(/<script type="application\/ld\+json" data-seo>\{"@context":"https:\/\/schema.org"/);
  });

  it('escapes attribute values and cannot break out of the JSON-LD script', () => {
    const html = headToHtml(buildHead({ ...page, title: 'A "quoted" <b>', jsonLd: [{ '@type': 'Thing', name: '</script><script>x' }] }));
    expect(html).toContain('content="A &quot;quoted&quot; &lt;b>"');
    expect(html).not.toContain('</script><script>x');
  });

  it('applyHead replaces only managed tags in the live document', () => {
    const keep = document.createElement('meta');
    keep.setAttribute('name', 'viewport');
    document.head.appendChild(keep);
    applyHead(buildHead(pageForPath('/')));
    applyHead(buildHead(page));
    expect(document.title).toBe(page.title);
    expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.head.querySelector('link[rel="canonical"]').getAttribute('href')).toBe('https://aicaller.store/pricing');
    expect(document.head.querySelector('meta[name="viewport"]')).not.toBeNull();
  });
});

describe('pricing parity', () => {
  // The public pricing page is pre-rendered without the API, so its numbers
  // are a copy — this keeps the copy honest against the billing config.
  it('matches api-service PACKS and TIER_LIMITS', () => {
    // Read as text: the file sits outside the frontend package, which Vite
    // won't import from. It is plain `export const` data, so evaluate that.
    const src = readFileSync(join(root, '..', 'api-service', 'src', 'config', 'billing.js'), 'utf8');
    const billing = new Function(`${src.replace(/^export /gm, '')}; return { PACKS, TIER_LIMITS };`)();
    expect(PRICING.map((p) => ({
      id: p.id, amountPaise: p.amountInr * 100, minutes: p.minutes, limits: p.limits,
    }))).toEqual(billing.PACKS.map((p) => ({
      id: p.id, amountPaise: p.amountPaise, minutes: p.minutes, limits: billing.TIER_LIMITS[p.tier],
    })));
    for (const [i, p] of billing.PACKS.entries()) {
      expect(p.rateDisplay).toBe(`₹${PRICING[i].ratePerMin.toFixed(2)}/min`);
    }
  });
});

describe('robots.txt', () => {
  const robots = readFileSync(join(root, 'public', 'robots.txt'), 'utf8');

  it('keeps private routes closed to every crawler, AI agents included', () => {
    // A single group: separate per-bot groups would exempt those bots from
    // the Disallow rules.
    expect(robots.match(/^Allow: \/$/gm)).toHaveLength(1);
    for (const path of ['/share/', '/invite/', '/admin', '/campaigns/']) {
      expect(robots).toContain(`Disallow: ${path}`);
    }
    for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended']) {
      expect(robots).toContain(`User-agent: ${bot}`);
    }
    expect(robots).toContain('Sitemap: https://aicaller.store/sitemap.xml');
  });
});
