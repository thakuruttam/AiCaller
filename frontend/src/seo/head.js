import { SITE, absoluteUrl } from './site';

// One page's <head> as a list of tag descriptors. The same list is rendered
// to static HTML by the pre-render step (headToHtml) and applied to the live
// document on client-side navigation (applyHead), so what a crawler reads in
// the HTML and what a browser shows after a route change are identical.
export function buildHead(page) {
  const url = absoluteUrl(page.path);
  const image = absoluteUrl(page.image || SITE.ogImage);
  const robots = page.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  const tags = [
    { tag: 'title', text: page.title },
    { tag: 'meta', attrs: { name: 'description', content: page.description } },
    { tag: 'meta', attrs: { name: 'robots', content: robots } },
    { tag: 'link', attrs: { rel: 'canonical', href: url } },
    { tag: 'meta', attrs: { property: 'og:type', content: 'website' } },
    { tag: 'meta', attrs: { property: 'og:site_name', content: SITE.name } },
    { tag: 'meta', attrs: { property: 'og:locale', content: SITE.locale } },
    { tag: 'meta', attrs: { property: 'og:title', content: page.title } },
    { tag: 'meta', attrs: { property: 'og:description', content: page.description } },
    { tag: 'meta', attrs: { property: 'og:url', content: url } },
    { tag: 'meta', attrs: { property: 'og:image', content: image } },
    { tag: 'meta', attrs: { property: 'og:image:width', content: String(SITE.ogImageWidth) } },
    { tag: 'meta', attrs: { property: 'og:image:height', content: String(SITE.ogImageHeight) } },
    { tag: 'meta', attrs: { property: 'og:image:alt', content: page.title } },
    { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
    { tag: 'meta', attrs: { name: 'twitter:title', content: page.title } },
    { tag: 'meta', attrs: { name: 'twitter:description', content: page.description } },
    { tag: 'meta', attrs: { name: 'twitter:image', content: image } },
  ];

  if (page.jsonLd?.length) {
    tags.push({
      tag: 'script',
      attrs: { type: 'application/ld+json' },
      text: JSON.stringify({ '@context': 'https://schema.org', '@graph': page.jsonLd }),
    });
  }
  return tags;
}

const escapeAttr = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const escapeText = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
// Inside <script> only "</" can break out; JSON never needs a raw one.
const escapeScript = (v) => String(v).replace(/<\//g, '<\\/');

export function headToHtml(tags) {
  return tags
    .map(({ tag, attrs = {}, text }) => {
      const a = Object.entries(attrs).map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join('');
      if (tag === 'meta' || tag === 'link') return `<${tag}${a} data-seo />`;
      const body = tag === 'script' ? escapeScript(text) : escapeText(text);
      return `<${tag}${a}${tag === 'title' ? '' : ' data-seo'}>${body}</${tag}>`;
    })
    .join('\n    ');
}

// Replaces the managed tags (marked data-seo) in the live <head>. Tags are
// matched by identity (name / property / rel), so tags the page head already
// has outside this list — charset, viewport, icons, fonts — are untouched.
export function applyHead(tags, doc = document) {
  doc.head.querySelectorAll('[data-seo]').forEach((el) => el.remove());
  for (const { tag, attrs = {}, text } of tags) {
    if (tag === 'title') {
      doc.title = text;
      continue;
    }
    const el = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    el.setAttribute('data-seo', '');
    if (text != null) el.textContent = text;
    doc.head.appendChild(el);
  }
}
