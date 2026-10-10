// Facts about the site every SEO surface repeats — page heads, JSON-LD,
// sitemap.xml and llms.txt are all generated from this file and pages.js, so
// a rename or a new URL changes everywhere at once instead of drifting.
export const SITE = {
  name: 'AI Caller Pro',
  url: 'https://aicaller.store',
  locale: 'en_US',
  language: 'en',
  tagline: 'AI voice calling & outbound campaign platform',
  description:
    'AI Caller Pro runs outbound phone campaigns with an AI voice agent: it places every call, holds a natural, interruptible conversation, then transcribes and scores the result — sentiment, outcome and answer quality — in real time.',
  logo: '/apple-touch-icon.png',
  ogImage: '/og-image.png',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  themeColor: '#ffffff',
  // Languages the voice agent can hold a call in today (content.js
  // CAPABILITIES); also used for schema.org availableLanguage.
  callLanguages: ['English', 'Hindi', 'Hinglish'],
};

export const absoluteUrl = (path = '/') => new URL(path, SITE.url).toString();
