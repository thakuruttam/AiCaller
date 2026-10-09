import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';
import { Button, Field, Input, IconButton, Tooltip } from '../components/ui';

const EyeIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOffIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const GoogleIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);
const MicrosoftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24">
    <rect width="11" height="11" rx="1.5" fill="#F25022"/>
    <rect x="13" width="11" height="11" rx="1.5" fill="#7FBA00"/>
    <rect y="13" width="11" height="11" rx="1.5" fill="#00A4EF"/>
    <rect x="13" y="13" width="11" height="11" rx="1.5" fill="#FFB900"/>
  </svg>
);
const ArrowRightIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
// Try each concept in the browser: A (soundwave), B (orbit), C (handset+spark), D ("A" monogram).
const LOGO_VARIANT = 'C';

const LOGO_BADGE_BG = LOGO_VARIANT === 'B'
  ? 'linear-gradient(135deg, #266df0, #94b9ff)'
  : '#266df0';

const LogoIcon = ({ size = 16 }) => {
  if (LOGO_VARIANT === 'A') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <rect x="10" y="18" width="3.4" height="4" rx="1.7" fill="white"/>
        <rect x="15.4" y="13" width="3.4" height="14" rx="1.7" fill="white"/>
        <rect x="20.8" y="8" width="3.4" height="24" rx="1.7" fill="white"/>
        <rect x="26.2" y="14" width="3.4" height="12" rx="1.7" fill="white"/>
      </svg>
    );
  }
  if (LOGO_VARIANT === 'B') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="10" stroke="white" strokeWidth="2.2" strokeDasharray="30 100" strokeLinecap="round" transform="rotate(-40 20 20)"/>
        <circle cx="20" cy="20" r="10" stroke="white" strokeWidth="2.2" strokeDasharray="30 100" strokeLinecap="round" transform="rotate(140 20 20)" opacity="0.55"/>
        <circle cx="20" cy="20" r="3.4" fill="white"/>
      </svg>
    );
  }
  if (LOGO_VARIANT === 'C') {
    return (
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <path d="M14 12.5c0-.9.7-1.6 1.6-1.6h2.4c.8 0 1.5.6 1.6 1.4.1.9.4 2 .7 2.8.2.6 0 1.3-.4 1.7l-1.4 1.4c1.4 2.6 3.5 4.7 6.1 6.1l1.4-1.4c.4-.4 1.1-.6 1.7-.4.9.3 1.9.6 2.8.7.8.1 1.4.8 1.4 1.6v2.4c0 .9-.7 1.6-1.6 1.6C21.9 29.5 12 20.6 12 14.6c0-.5 0-1 .1-1.5" fill="white"/>
        <circle cx="28" cy="12" r="3" fill="white"/>
        <path d="M28 9.5v-1.3M28 15.5v-1.3M25.5 12h-1.3M31.8 12h-1.3" stroke="white" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path d="M20 9 L28 30 L24.5 30 L22.7 25 L17.3 25 L15.5 30 L12 30 Z M20 14.5 L18 21 L22 21 Z" fill="white"/>
    </svg>
  );
};
// Filled toast icons, shape matched to the MUI/notistack Snackbar icons on qa-app.biobrain.io/login
const ToastErrorIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
  </svg>
);
const ToastSuccessIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
  </svg>
);

export default function Login() {
  const { login, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail]          = useState('');
  const [password, setPassword]    = useState('');
  const [showPwd, setShowPwd]      = useState(false);
  const [errorCode, setErrorCode]  = useState('');
  const [loading, setLoading]      = useState(false);
  const [toast, setToast]          = useState(() => {
    const message = {
      google_failed:         'Google sign-in failed. Please try again.',
      google_not_configured: 'Google sign-in is not set up on this server. Use your email and password.'
    }[searchParams.get('error')];
    return message ? { type: 'error', message } : null;
  });
  const [mounted, setMounted]      = useState(false);
  const canSubmit = email.trim().length > 0 && password.length > 0;

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { document.title = 'Sign in — AI Caller Pro'; }, []);
  useEffect(() => {
    if (!toast || toast.type !== 'error') return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/auth/google`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setToast(null);
    setErrorCode('');
    setLoading(true);
    try {
      await login(email, password);
      setToast({ type: 'success', message: 'Login successful' });
      setTimeout(() => navigate(from, { replace: true }), 900);
    } catch (err) {
      setToast({ type: 'error', message: err.response?.data?.error || 'Invalid email or password' });
      setErrorCode(err.response?.data?.code || '');
    } finally {
      setLoading(false);
    }
  };

  // Already signed in — skip the login form and go straight to the app.
  // (Skip this while the just-logged-in success toast is showing, so it
  // stays on screen for its full duration instead of being unmounted the
  // instant `user` is set — the setTimeout below handles that redirect.)
  if (!isLoading && user && toast?.type !== 'success') {
    return <Navigate to={from} replace />;
  }

  return (
    <>
      <style>{`
        .login-page, .login-page *, .login-page *::before, .login-page *::after {
          box-sizing: border-box;
        }

        @keyframes enter-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse-ring {
          0%   { box-shadow: 0 0 0 0 rgba(38,109,240,0.30); }
          70%  { box-shadow: 0 0 0 6px rgba(38,109,240,0); }
          100% { box-shadow: 0 0 0 0 rgba(38,109,240,0); }
        }
        .anim-enter { animation: enter-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .anim-toast { animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .google-btn-highlight { animation: pulse-ring 1.6s ease-out 2; }

        @media (prefers-reduced-motion: reduce) {
          .anim-enter, .anim-toast { animation: none; }
          .google-btn-highlight { animation: none; }
        }
      `}</style>

      <main className="login-page flex min-h-screen overflow-x-hidden">

        {/* ════════════════════════════════════════
            LEFT — Dark Info Panel
        ════════════════════════════════════════ */}
        <section className="hidden lg:flex flex-col justify-between w-[48%] bg-ink-50 p-6 relative overflow-hidden">

          {/* Glowing blurred gradient blob background */}
          <div className="absolute inset-0 pointer-events-none" style={{ filter: 'blur(70px)' }}>
            <div className="absolute -top-24 -right-24 w-[520px] h-[520px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(38,109,240,0.55) 0%, transparent 70%)' }} />
            <div className="absolute top-1/3 -left-16 w-[420px] h-[420px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(83,139,243,0.32) 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 left-1/4 w-[460px] h-[460px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(148,185,255,0.28) 0%, transparent 70%)' }} />
          </div>

          {/* Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-chip flex items-center justify-center" style={{ background: LOGO_BADGE_BG, boxShadow: '0 4px 14px rgba(38,109,240,0.35)' }}>
              <LogoIcon size={19} />
            </div>
            <span className="font-semibold text-white text-lg">AI Caller Pro</span>
          </div>

          {/* Main content */}
          <div className="relative z-10 space-y-6 max-w-sm">

            {/* Headline */}
            <div>
              <p className="text-xs font-semibold text-brand-300 mb-3">AI-Powered Voice Platform</p>
              <h2 className="text-[2rem] font-semibold text-white leading-[1.18]">
                Close more deals.<br />
                <span className="text-brand-300">Automatically.</span>
              </h2>
              <p className="mt-3 text-sm text-ink-900 leading-relaxed">
                Deploy AI agents that qualify, pitch, and follow up — at enterprise scale, 24 / 7.
              </p>
            </div>

          </div>

          {/* Trust line */}
          <p className="relative z-10 text-xs text-ink-800 tracking-wide">
            Trusted by 500+ enterprise teams
          </p>
        </section>

        {/* ════════════════════════════════════════
            RIGHT — Login Form
        ════════════════════════════════════════ */}
        <section className="flex-1 flex flex-col items-center px-8 py-10 bg-paper-300 dark:bg-ink-50">
          <div className={`bg-card dark:bg-muted rounded-2xl shadow-primary w-full max-w-[460px] my-auto flex flex-col p-8 sm:p-10 ${mounted ? 'anim-enter' : 'opacity-0'}`}>

            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2.5 mb-6">
              <div className="w-8 h-8 rounded-chip flex items-center justify-center" style={{ background: LOGO_BADGE_BG }}>
                <LogoIcon size={17} />
              </div>
              <span className="font-semibold text-ink-100 dark:text-white text-lg">AI Caller Pro</span>
            </div>

            {/* Heading */}
            <div className="mb-6">
              <h1 className="text-[22px] font-semibold text-ink-100 dark:text-white leading-tight mb-1.5">
                Login
              </h1>
              <p className="text-sm text-ink-700 dark:text-ink-800">
                Please enter your email and password to continue.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

              <Field label="Email" htmlFor="email">
                <Input
                  id="email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  autoComplete="email" required
                />
              </Field>

              <div>
                <Field label="Password" htmlFor="password">
                  <Input
                    id="password" type={showPwd ? 'text' : 'password'}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password" required
                    trailing={
                      <IconButton
                        size="sm"
                        type="button"
                        title={showPwd ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPwd(!showPwd)}
                      >
                        {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                      </IconButton>
                    }
                  />
                </Field>
                <div className="text-right mt-2">
                  <Link to="/forgot-password" className="text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors">
                    Forgot password?
                  </Link>
                </div>
              </div>

              <Button
                type="submit" size="lg" fullWidth
                loading={loading} disabled={!canSubmit}
                iconRight={loading ? undefined : 'arrow_forward'}
              >
                {loading ? 'Authenticating…' : 'Sign in'}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-paper-500 dark:border-ink-400" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-paper-100 dark:bg-ink-200 px-3 text-[12px] font-medium text-ink-800 ">
                  or continue with
                </span>
              </div>
            </div>

            {/* Social buttons */}
            <div className="flex items-center justify-center gap-3">
              <Tooltip label="Continue with Google">
                <IconButton
                  as="button"
                  size="lg"
                  onClick={handleGoogleLogin}
                  title="Continue with Google"
                  className={`w-[46px] h-[46px] border border-paper-500 dark:border-ink-400 bg-paper-100 dark:bg-white/[0.04] ${
                    errorCode === 'GOOGLE_ACCOUNT_NO_PASSWORD' ? 'google-btn-highlight !border-brand-500' : ''
                  }`}
                >
                  <GoogleIcon />
                </IconButton>
              </Tooltip>
              <Tooltip label="Continue with Microsoft">
                <IconButton
                  as="button"
                  size="lg"
                  title="Continue with Microsoft"
                  className="w-[46px] h-[46px] border border-paper-500 dark:border-ink-400 bg-paper-100 dark:bg-white/[0.04]"
                >
                  <MicrosoftIcon />
                </IconButton>
              </Tooltip>
            </div>

            <p className="mt-6 text-center text-[12px] text-ink-700 dark:text-ink-800">
              New to AI Caller?{' '}
              <a href="#" className="font-semibold text-brand-500 hover:text-brand-600 transition-colors">
                Start free trial
              </a>
            </p>

          </div>
        </section>

        {/* Toast — bottom-left, card style matched to this page's own surface/hairline language */}
        {toast && (
          <div className="bg-card dark:bg-muted rounded-2xl fixed z-50 anim-toast flex items-center gap-3 shadow-raised"
            style={{
              left: '24px', bottom: '24px',
              minWidth: '300px',
              padding: '13px 20px 13px 16px',
              borderLeft: `3px solid ${toast.type === 'success' ? '#0fc27b' : '#ff5b59'}`,
            }}>
            <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full"
              style={{
                background: toast.type === 'success' ? 'rgba(15,194,123,0.12)' : 'rgba(255,91,89,0.12)',
                color: toast.type === 'success' ? '#0db472' : '#f65351',
              }}>
              {toast.type === 'success' ? <ToastSuccessIcon size={17} /> : <ToastErrorIcon size={17} />}
            </span>
            <span className="text-sm font-medium leading-snug text-ink-400 dark:text-ink-900">{toast.message}</span>
          </div>
        )}
      </main>
    </>
  );
}
