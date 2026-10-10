import { useEffect } from 'react';
import { buildHead, applyHead } from './head';
import { pageForPath } from './pages';

// Keeps the document head in step with the current public page on client-side
// navigation. The first paint already has the right head from the
// pre-rendered HTML; this covers moving between pages without a reload.
export function useSeo(path) {
  useEffect(() => {
    const page = pageForPath(path);
    if (page) applyHead(buildHead(page));
  }, [path]);
}
