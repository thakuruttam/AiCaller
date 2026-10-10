import Marketing from './index';
import Pricing from './Pricing';
import Product from './Product';
import Security from './Security';
import FaqPage from './Faq';
import { UseCasesIndex, UseCaseDetail } from './UseCases';

// The public site's routes, shared by App.jsx (in the browser) and
// entry-prerender.jsx (at build time) so a page can't be routable in one and
// missing from the other. "/" is listed for the pre-render; App.jsx renders
// it through RootRoute, which also handles signed-in visitors.
export const MARKETING_ROUTES = [
  { path: '/', Component: Marketing },
  { path: '/product', Component: Product },
  { path: '/use-cases', Component: UseCasesIndex },
  { path: '/use-cases/:slug', Component: UseCaseDetail },
  { path: '/pricing', Component: Pricing },
  { path: '/security', Component: Security },
  { path: '/faq', Component: FaqPage },
];
