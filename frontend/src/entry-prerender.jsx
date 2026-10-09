import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter, Routes, Route } from 'react-router';
import Marketing from './pages/marketing';
import Pricing from './pages/marketing/Pricing';
import { UseCasesIndex, UseCaseDetail } from './pages/marketing/UseCases';

export { PUBLIC_PAGES } from './seo/pages';
export { buildHead, headToHtml } from './seo/head';
export { SITE, absoluteUrl } from './seo/site';
export { FAQS, PRICING, PRICING_FAQS, USE_CASES, CAPABILITIES, STEPS, TRUST } from './pages/marketing/content';

// Build-time only (scripts/prerender.js): renders each public page to HTML so
// crawlers, answer engines and link previews get the full content without
// running JavaScript. Mirrors the public routes in App.jsx; the app's auth,
// theme and data providers are deliberately absent — these pages need none.
export function render(url) {
  return renderToString(
    <StaticRouter location={url}>
      <Routes>
        <Route path="/" element={<Marketing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/use-cases" element={<UseCasesIndex />} />
        <Route path="/use-cases/:slug" element={<UseCaseDetail />} />
      </Routes>
    </StaticRouter>,
  );
}
