import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' }
});

// Inject access token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// On 401, try silent refresh — on failure, redirect to login.
// A single in-flight refresh is shared across all concurrent 401s instead of
// each one racing its own POST /api/auth/refresh: a burst of simultaneous
// requests (e.g. polling right after a call) hitting an expired token used to
// fire N redundant refresh calls at once.
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken) throw new Error('No refresh token');

          const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
          refreshPromise = axios.post(`${baseURL}/api/auth/refresh`, { refreshToken })
            .then(({ data }) => {
              localStorage.setItem('accessToken', data.accessToken);
              return data.accessToken;
            })
            .finally(() => { refreshPromise = null; });
        }
        const accessToken = await refreshPromise;
        original.headers['Authorization'] = `Bearer ${accessToken}`;
        return api(original);
      } catch (_) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
