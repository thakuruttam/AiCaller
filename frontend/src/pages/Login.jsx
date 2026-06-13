import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/Spinner';

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
const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const ArrowRightIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
const PhoneIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.09 6.09l.95-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);
const TrendUpIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
  </svg>
);
const ActivityIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const UsersIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const AlertIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const LockIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const BARS = [38, 55, 42, 70, 52, 85, 65, 90, 58, 75, 62, 95];
function SparkBars() {
  return (
    <div className="flex items-end gap-[3px] h-9">
      {BARS.map((h, i) => (
        <div key={i} className="flex-1 rounded-sm" style={{
          height: `${h}%`,
          background: i >= BARS.length - 3 ? '#0d9488' : `rgba(13,148,136,${0.2 + (i / BARS.length) * 0.45})`,
        }} />
      ))}
    </div>
  );
}

const CALLS = [
  { name: 'Sarah Mitchell', status: 'Connected',  dur: '2:14' },
  { name: "James O'Brien",  status: 'Qualifying', dur: '0:47' },
  { name: 'Priya Sharma',   status: 'Completed',  dur: '4:02' },
  { name: 'Tom Wallace',    status: 'Ringing',    dur: '0:08' },
];

const STATUS = {
  Connected:  { dot: '#0d9488', bg: 'rgba(13,148,136,0.12)',  text: '#0d9488'  },
  Qualifying: { dot: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  text: '#3b82f6'  },
  Completed:  { dot: '#475569', bg: 'rgba(71,85,105,0.15)',   text: '#64748b'  },
  Ringing:    { dot: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  text: '#f59e0b'  },
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail]          = useState('');
  const [password, setPassword]    = useState('');
  const [showPwd, setShowPwd]      = useState(false);
  const [remember, setRemember]    = useState(false);
  const [error, setError]          = useState(
    searchParams.get('error') === 'google_failed' ? 'Google sign-in failed. Please try again.' : ''
  );
  const [loading, setLoading]      = useState(false);
  const [showToast, setShowToast]  = useState(false);
  const [mounted, setMounted]      = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleGoogleLogin = () => { window.location.href = 'http://localhost:3000/api/auth/google'; };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      setShowToast(true);
      setTimeout(() => navigate(from, { replace: true }), 900);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; }

        @keyframes enter-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-in {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.2; }
        }
        .anim-enter { animation: enter-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .anim-toast { animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .dot-blink  { animation: blink 1.8s ease-in-out infinite; }

        .input-field {
          width: 100%; height: 48px; padding: 0 14px;
          border-radius: 10px; font-size: 0.9rem;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none; font-family: inherit;
        }
        .input-field:focus {
          border-color: #0d9488 !important;
          box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
        }

        @media (prefers-reduced-motion: reduce) {
          .anim-enter, .anim-toast { animation: none; }
          .dot-blink { animation: none; }
        }
      `}</style>

      <main className="flex min-h-screen">

        {/* ════════════════════════════════════════
            LEFT — Dark Info Panel
        ════════════════════════════════════════ */}
        <section className="hidden lg:flex flex-col justify-between w-[48%] bg-[#0a0f1a] p-12 relative overflow-hidden">

          {/* Subtle background tint */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(13,148,136,0.12) 0%, transparent 70%)' }} />
            <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' }} />
          </div>

          {/* Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0d9488] flex items-center justify-center shadow-lg" style={{ boxShadow: '0 4px 14px rgba(13,148,136,0.35)' }}>
              <PhoneIcon size={17} />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">AI Caller Pro</span>
          </div>

          {/* Main content */}
          <div className="relative z-10 space-y-8">

            {/* Headline */}
            <div>
              <p className="text-xs font-semibold text-[#0d9488] uppercase tracking-widest mb-3">AI-Powered Voice Platform</p>
              <h2 className="text-[2.4rem] font-extrabold text-white leading-[1.18] tracking-tight">
                Close more deals.<br />
                <span className="text-[#0d9488]">Automatically.</span>
              </h2>
              <p className="mt-4 text-sm text-slate-400 leading-relaxed max-w-sm">
                Deploy AI agents that qualify, pitch, and follow up — at enterprise scale, 24 / 7.
              </p>
            </div>

            {/* Stat chips */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: <PhoneIcon />,    val: '1,247', label: 'Active calls'  },
                { icon: <TrendUpIcon />,  val: '34.2%', label: 'Conv. rate'    },
                { icon: <ActivityIcon />, val: '140ms', label: 'Avg latency'   },
              ].map((m) => (
                <div key={m.label} className="rounded-xl p-3.5" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center gap-1.5 text-[#0d9488] mb-2">
                    {m.icon}
                    <span className="text-[10px] font-semibold uppercase tracking-wide">{m.label}</span>
                  </div>
                  <p className="text-white font-bold text-lg leading-none">{m.val}</p>
                </div>
              ))}
            </div>

            {/* Chart card */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-slate-500 mb-0.5">Calls completed · last 12 hrs</p>
                  <p className="text-white font-bold text-xl leading-none">8,412</p>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: '#0d9488', background: 'rgba(13,148,136,0.12)', border: '1px solid rgba(13,148,136,0.2)' }}>
                  <TrendUpIcon /> +12.4%
                </span>
              </div>
              <SparkBars />
            </div>

            {/* Live call feed */}
            <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="dot-blink w-1.5 h-1.5 rounded-full bg-[#0d9488] flex-shrink-0" />
                <UsersIcon />
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Live Calls</span>
                <span className="ml-auto text-xs font-semibold text-[#0d9488]">{CALLS.length} active</span>
              </div>
              {CALLS.map((c, i) => {
                const s = STATUS[c.status];
                return (
                  <div key={c.name} className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                      <span className="text-sm text-slate-300 font-medium">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: s.text, background: s.bg }}>{c.status}</span>
                      <span className="text-xs text-slate-600 font-mono w-8 text-right">{c.dur}</span>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Trust bar */}
          <div className="relative z-10 pt-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs text-slate-600 uppercase tracking-widest font-semibold mb-3">Trusted by 500+ enterprise teams</p>
            <div className="flex gap-5 items-center">
              {[72, 88, 60, 80].map((w, i) => (
                <div key={i} className="h-3.5 rounded-sm" style={{ width: w, background: 'rgba(255,255,255,0.1)' }} />
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════
            RIGHT — Login Form
        ════════════════════════════════════════ */}
        <section className="flex-1 flex flex-col justify-center items-center px-8 sm:px-14 bg-white dark:bg-[#07090e]">
          <div className={`w-full max-w-[380px] ${mounted ? 'anim-enter' : 'opacity-0'}`}>

            {/* Mobile logo */}
            <div className="lg:hidden flex items-center gap-2.5 mb-10">
              <div className="w-8 h-8 rounded-xl bg-[#0d9488] flex items-center justify-center">
                <PhoneIcon size={15} />
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">AI Caller Pro</span>
            </div>

            {/* Heading */}
            <div className="mb-7">
              <h1 className="text-[1.7rem] font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight mb-1.5">
                Welcome back
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Sign in to your workspace to continue.
              </p>
            </div>

            {/* Social buttons */}
            <div className="space-y-2.5 mb-5">
              <button
                onClick={handleGoogleLogin}
                className="w-full h-[46px] flex items-center justify-center gap-2.5 rounded-[10px] text-sm font-medium transition-all duration-150 cursor-pointer bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.07]"
                style={{ border: '1px solid #e2e8f0' }}
              >
                <GoogleIcon /> Continue with Google
              </button>
              <button
                className="w-full h-[46px] flex items-center justify-center gap-2.5 rounded-[10px] text-sm font-medium transition-all duration-150 cursor-pointer bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.07]"
                style={{ border: '1px solid #e2e8f0' }}
              >
                <MicrosoftIcon /> Continue with Microsoft
              </button>
            </div>

            {/* Divider */}
            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100 dark:border-white/[0.06]" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-[#07090e] px-3 text-[11px] font-medium text-slate-400 uppercase tracking-widest">
                  or with email
                </span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 rounded-[10px] flex items-start gap-2 bg-red-50 dark:bg-red-950/40" style={{ border: '1px solid #fecaca' }}>
                <span className="text-red-500 flex-shrink-0 mt-0.5"><AlertIcon /></span>
                <p className="text-sm text-red-700 dark:text-red-400 leading-snug">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                  Work Email
                </label>
                <input
                  id="email" type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required placeholder="you@company.com"
                  className="input-field bg-slate-50 dark:bg-white/[0.04] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600"
                  style={{ border: '1px solid #e2e8f0' }}
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label htmlFor="password" className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                    Password
                  </label>
                  <a href="#" className="text-xs font-medium text-[#0d9488] hover:text-[#0f766e] transition-colors">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <input
                    id="password" type={showPwd ? 'text' : 'password'}
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    required placeholder="••••••••"
                    className="input-field bg-slate-50 dark:bg-white/[0.04] text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 pr-11"
                    style={{ border: '1px solid #e2e8f0' }}
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer">
                    {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* Remember */}
              <div className="flex items-center gap-2.5 pt-0.5">
                <div onClick={() => setRemember(!remember)}
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 cursor-pointer transition-all"
                  style={{
                    background: remember ? '#0d9488' : 'white',
                    border: remember ? '1px solid #0d9488' : '1px solid #cbd5e1',
                    color: 'white',
                  }}>
                  {remember && <CheckIcon />}
                </div>
                <label onClick={() => setRemember(!remember)}
                  className="text-sm text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                  Stay signed in for 30 days
                </label>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="w-full h-[48px] text-white text-sm font-semibold rounded-[10px] flex items-center justify-center gap-2 mt-1 active:scale-[0.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                style={{ background: '#0d9488', boxShadow: '0 4px 14px rgba(13,148,136,0.3)' }}
                onMouseEnter={e => e.currentTarget.style.background = '#0f766e'}
                onMouseLeave={e => e.currentTarget.style.background = '#0d9488'}
              >
                {loading
                  ? <><Spinner size={16} className="text-white" /><span>Authenticating…</span></>
                  : <><span>Sign in</span><ArrowRightIcon /></>
                }
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-500">
              New to AI Caller?{' '}
              <a href="#" className="font-semibold text-[#0d9488] hover:text-[#0f766e] transition-colors">
                Start free trial
              </a>
            </p>

            <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-600">
              <LockIcon /><span>256-bit SSL · SOC 2 Type II certified</span>
            </div>

          </div>
        </section>

        {/* Toast */}
        {showToast && (
          <div className="fixed bottom-6 right-6 z-50 anim-toast text-white px-5 py-4 rounded-xl flex items-center gap-3.5"
            style={{ background: '#0a0f1a', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[#0d9488] flex-shrink-0"
              style={{ background: 'rgba(13,148,136,0.15)', border: '1px solid rgba(13,148,136,0.3)' }}>
              <CheckIcon />
            </div>
            <div>
              <p className="text-sm font-semibold">Signed in</p>
              <p className="text-xs text-slate-500 mt-0.5">Redirecting to dashboard…</p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
