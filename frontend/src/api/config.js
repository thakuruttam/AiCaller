/**
 * API base URLs for local dev vs production.
 *
 * Local dev: use relative URLs (empty base) so Vite proxies /api and /reports
 * to the gateway on :8080 — avoids CORS entirely.
 *
 * Remote dev (ngrok): set VITE_API_URL=https://your-tunnel.ngrok-free.app
 */
function resolveBaseUrl() {
  const env = import.meta.env.VITE_API_URL || import.meta.env.VITE_EVAL_URL;

  if (import.meta.env.DEV) {
    // localhost targets → Vite proxy (see vite.config.js)
    if (!env || /localhost|127\.0\.0\.1/.test(env)) return '';
    return env;
  }

  return env || 'http://localhost:8080';
}

export const API_BASE = resolveBaseUrl();
export const EVAL_BASE = resolveBaseUrl();
