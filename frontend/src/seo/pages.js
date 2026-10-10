import { SITE, absoluteUrl } from './site';
import { PRICING, USE_CASES, CAPABILITIES, FAQ_GROUPS, DEMO_VIDEO } from '../pages/marketing/content';

// Every public, indexable page and what search engines and AI agents are told
// about it. The runtime <head> (useSeo), the pre-rendered HTML, sitemap.xml
// and llms.txt are all generated from this list — add a page here and it is
// discoverable everywhere at once.

const organization = {
  '@type': 'Organization',
  '@id': `${SITE.url}/#organization`,
  name: SITE.name,
  url: absoluteUrl('/'),
  logo: absoluteUrl(SITE.logo),
};

const website = {
  '@type': 'WebSite',
  '@id': `${SITE.url}/#website`,
  url: absoluteUrl('/'),
  name: SITE.name,
  description: SITE.description,
  inLanguage: SITE.language,
  publisher: { '@id': organization['@id'] },
};

const prices = PRICING.map((p) => p.amountInr);

const software = {
  '@type': 'SoftwareApplication',
  '@id': `${SITE.url}/#software`,
  name: SITE.name,
  url: absoluteUrl('/'),
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'AI voice calling',
  operatingSystem: 'Web',
  description: SITE.description,
  featureList: CAPABILITIES.map((c) => `${c.title}: ${c.body}`),
  availableLanguage: SITE.callLanguages,
  screenshot: [
    absoluteUrl('/product/campaign-builder.jpg'),
    absoluteUrl('/product/dashboard.jpg'),
    absoluteUrl('/product/campaign-report.jpg'),
  ],
  publisher: { '@id': organization['@id'] },
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'INR',
    lowPrice: Math.min(...prices),
    highPrice: Math.max(...prices),
    offerCount: PRICING.length,
    url: absoluteUrl('/pricing'),
    availability: 'https://schema.org/InStock',
  },
};

const faqPage = (id, faqs) => ({
  '@type': 'FAQPage',
  '@id': id,
  mainEntity: faqs.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
});

const breadcrumbs = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: item.name,
    item: absoluteUrl(item.path),
  })),
});

const webPage = (path, title, description) => ({
  '@type': 'WebPage',
  '@id': `${absoluteUrl(path)}#webpage`,
  url: absoluteUrl(path),
  name: title,
  description,
  inLanguage: SITE.language,
  isPartOf: { '@id': website['@id'] },
  about: { '@id': software['@id'] },
});

const HOME_TITLE = `${SITE.name} — AI Voice Calling & Outbound Campaign Platform`;
const HOME_DESCRIPTION =
  'Run outbound phone campaigns with an AI voice agent that holds natural calls in English, Hindi or Hinglish and scores every call for outcome and sentiment.';

const PRICING_TITLE = `Pricing — Pay-as-you-go AI Calling from ₹${PRICING[PRICING.length - 1].ratePerMin.toFixed(2)}/min | ${SITE.name}`;
const PRICING_DESCRIPTION = `Prepaid call-minute packs from ₹${PRICING[0].amountInr.toLocaleString('en-IN')} — no subscription. Per-minute rates from ₹${PRICING[0].ratePerMin.toFixed(2)} down to ₹${PRICING[PRICING.length - 1].ratePerMin.toFixed(2)}, with the AI agent, transcription and call evaluation included.`;

const USE_CASES_TITLE = `AI Calling Use Cases: HR, Sales & Collections | ${SITE.name}`;
const USE_CASES_DESCRIPTION =
  'How teams use an AI voice agent for outbound calls: candidate screening, recruiting, sales qualification, EMI reminders, collections and CSAT surveys.';

export const PUBLIC_PAGES = [
  {
    path: '/',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    changefreq: 'weekly',
    priority: 1.0,
    jsonLd: [
      organization,
      website,
      software,
      webPage('/', HOME_TITLE, HOME_DESCRIPTION),
      {
        '@type': 'VideoObject',
        '@id': `${SITE.url}/#demo-video`,
        name: DEMO_VIDEO.title,
        description: DEMO_VIDEO.description,
        thumbnailUrl: absoluteUrl(DEMO_VIDEO.poster),
        contentUrl: absoluteUrl(DEMO_VIDEO.src),
        uploadDate: DEMO_VIDEO.uploadDate,
        duration: DEMO_VIDEO.duration,
        publisher: { '@id': organization['@id'] },
      },
    ],
  },
  {
    path: '/pricing',
    title: PRICING_TITLE,
    description: PRICING_DESCRIPTION,
    changefreq: 'monthly',
    priority: 0.9,
    breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Pricing', path: '/pricing' }],
    jsonLd: [
      organization,
      webPage('/pricing', PRICING_TITLE, PRICING_DESCRIPTION),
      {
        '@type': 'Product',
        '@id': `${absoluteUrl('/pricing')}#product`,
        name: `${SITE.name} call-minute packs`,
        description: PRICING_DESCRIPTION,
        brand: { '@id': organization['@id'] },
        offers: PRICING.map((p) => ({
          '@type': 'Offer',
          name: `${p.label} — ${p.minutes.toLocaleString('en-IN')} minutes`,
          price: p.amountInr,
          priceCurrency: 'INR',
          availability: 'https://schema.org/InStock',
          url: absoluteUrl('/pricing'),
        })),
      },
    ],
  },
  {
    path: '/product',
    title: `AI Calling Software Features | ${SITE.name}`,
    description: 'No-code campaign builder, 30 AI voices, branching questions, CSV import, live dashboards, automatic call scoring, recordings and shareable reports.',
    changefreq: 'monthly',
    priority: 0.9,
    breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Product', path: '/product' }],
    jsonLd: [organization, software, webPage('/product', `AI Calling Software Features | ${SITE.name}`, 'No-code campaign builder, 30 AI voices, branching questions, CSV import, live dashboards, automatic call scoring, recordings and shareable reports.')],
  },
  {
    path: '/security',
    title: `Security & Data Protection | ${SITE.name}`,
    description: 'How AI Caller Pro protects your calls and data: workspace isolation, role-based access, hashed passwords, expiring share links and full call provenance.',
    changefreq: 'monthly',
    priority: 0.7,
    breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Security', path: '/security' }],
    jsonLd: [organization, webPage('/security', `Security & Data Protection | ${SITE.name}`, 'How AI Caller Pro protects your calls and data: workspace isolation, role-based access, hashed passwords, expiring share links and full call provenance.')],
  },
  {
    path: '/faq',
    title: `FAQ — AI Voice Calling, Pricing & Security | ${SITE.name}`,
    description: 'Answers about how the AI voice agent places and scores calls, which languages it speaks, how per-minute billing works and how your data is protected.',
    changefreq: 'monthly',
    priority: 0.7,
    breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'FAQ', path: '/faq' }],
    // The one place FAQ structured data lives — each question has a single
    // canonical page, even though some also show on Pricing and Security.
    jsonLd: [organization, webPage('/faq', `FAQ — AI Voice Calling, Pricing & Security | ${SITE.name}`, 'Answers about how the AI voice agent places and scores calls, which languages it speaks, how per-minute billing works and how your data is protected.'), faqPage(`${absoluteUrl('/faq')}#faq`, FAQ_GROUPS.flatMap((g) => g.items))],
  },
  {
    path: '/use-cases',
    title: USE_CASES_TITLE,
    description: USE_CASES_DESCRIPTION,
    changefreq: 'monthly',
    priority: 0.8,
    breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Use cases', path: '/use-cases' }],
    jsonLd: [
      organization,
      webPage('/use-cases', USE_CASES_TITLE, USE_CASES_DESCRIPTION),
      {
        '@type': 'ItemList',
        itemListElement: USE_CASES.map((u, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: u.name,
          url: absoluteUrl(`/use-cases/${u.slug}`),
        })),
      },
    ],
  },
  ...USE_CASES.map((u) => {
    const path = `/use-cases/${u.slug}`;
    const title = `${u.title} | ${SITE.name}`;
    return {
      path,
      title,
      description: u.description,
      changefreq: 'monthly',
      priority: 0.8,
      breadcrumbs: [{ name: 'Home', path: '/' }, { name: 'Use cases', path: '/use-cases' }, { name: u.name, path }],
      jsonLd: [organization, webPage(path, title, u.description)],
    };
  }),
];

// BreadcrumbList is derived rather than hand-listed so the visible trail and
// the structured one can't disagree.
for (const page of PUBLIC_PAGES) {
  if (page.breadcrumbs) page.jsonLd.push(breadcrumbs(page.breadcrumbs));
}

export const pageForPath = (path) => {
  const clean = path.replace(/\/+$/, '') || '/';
  return PUBLIC_PAGES.find((p) => p.path === clean) ?? null;
};
