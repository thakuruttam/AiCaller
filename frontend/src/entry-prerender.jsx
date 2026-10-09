import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter, Routes, Route } from 'react-router';
import { MARKETING_ROUTES } from './pages/marketing/routes';

export { PUBLIC_PAGES } from './seo/pages';
export { buildHead, headToHtml } from './seo/head';
export { SITE, absoluteUrl } from './seo/site';
export { FAQS, PRICING, PRICING_FAQS, USE_CASES, CAPABILITIES, STEPS, TRUST, PRODUCT_SECTIONS, SECURITY_SECTIONS, SECURITY_FAQS, FAQ_GROUPS } from './pages/marketing/content';

// Build-time only (scripts/prerender.js): renders each public page to HTML so
// crawlers, answer engines and link previews get the full content without
// running JavaScript. Uses the same route list as App.jsx; the app's auth,
// theme and data providers are deliberately absent — these pages need none.
export function render(url) {
  return renderToString(
    <StaticRouter location={url}>
      <Routes>
        {MARKETING_ROUTES.map((route) => {
          const Page = route.Component;
          return <Route key={route.path} path={route.path} element={<Page />} />;
        })}
      </Routes>
    </StaticRouter>,
  );
}
