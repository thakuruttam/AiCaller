import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      setShowToast(true);
      setTimeout(() => navigate(from, { replace: true }), 800);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen bg-[#fcf8ff]">
      {/* Left Panel */}
      <section className="hidden lg:flex flex-col justify-between w-[45%] bg-[#0f172a] p-12 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-[#3525cd] rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-5%] left-[-5%] w-64 h-64 bg-[#4f46e5] rounded-full blur-[100px]"></div>
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#3525cd] flex items-center justify-center rounded-lg">
            <span className="material-symbols-outlined text-white" style={{fontVariationSettings:"'FILL' 1"}}>graphic_eq</span>
          </div>
          <h1 className="font-bold text-white text-xl tracking-tight">AI Caller Pro</h1>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-5xl font-bold text-white mb-8 leading-tight tracking-tight">Make every call count</h2>
          <div className="space-y-6">
            {[
              { title: '99.9% Voice Accuracy', desc: 'Neural processing ensures every interaction feels human, empathetic, and ultra-clear.' },
              { title: 'Instant Scale', desc: 'Handle 10 or 10,000 simultaneous calls without adding a single headcount.' },
              { title: 'Real-time Analytics', desc: 'Watch conversions happen in real-time with automated CRM logging.' },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-4">
                <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                  <span className="material-symbols-outlined text-emerald-400 text-[18px]" style={{fontVariationSettings:"'FILL' 1"}}>check</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1">{f.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 pt-8 border-t border-white/10">
          <p className="text-[11px] text-zinc-500 uppercase tracking-widest mb-4" style={{fontFamily:'JetBrains Mono, monospace'}}>Trusted by Enterprise Leaders</p>
          <div className="flex gap-8 opacity-40">
            <div className="h-6 w-24 bg-zinc-700 rounded-sm"></div>
            <div className="h-6 w-24 bg-zinc-700 rounded-sm"></div>
            <div className="h-6 w-24 bg-zinc-700 rounded-sm"></div>
          </div>
        </div>
      </section>

      {/* Right Panel */}
      <section className="flex-1 flex flex-col justify-center items-center px-6 md:px-8 bg-white">
        <div className="w-full max-w-[400px]">
          {/* Mobile branding */}
          <div className="lg:hidden flex items-center gap-2 mb-12">
            <div className="w-8 h-8 bg-[#3525cd] flex items-center justify-center rounded-lg">
              <span className="material-symbols-outlined text-white text-[20px]" style={{fontVariationSettings:"'FILL' 1"}}>graphic_eq</span>
            </div>
            <span className="font-bold text-[#1b1b24] text-xl">AI Caller Pro</span>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-semibold text-[#1b1b24] mb-2 tracking-tight">Welcome back</h2>
            <p className="text-base text-[#464555]">Enter your credentials to access your dashboard.</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-lg flex items-center gap-2">
              <span className="material-symbols-outlined text-[#ba1a1a] text-[18px]">error</span>
              <p className="text-sm text-[#93000a]">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm text-[#464555]" style={{fontFamily:'JetBrains Mono, monospace'}} htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@company.com"
                className="w-full h-12 px-4 bg-white border border-[#c7c4d8] rounded-lg text-base text-[#1b1b24] focus:outline-none focus:ring-2 focus:ring-[#3525cd] focus:ring-offset-2 focus:border-[#3525cd] transition-all placeholder:text-[#777587]"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-sm text-[#464555]" style={{fontFamily:'JetBrains Mono, monospace'}} htmlFor="password">Password</label>
                <a href="#" className="text-xs text-[#3525cd] hover:underline" style={{fontFamily:'JetBrains Mono, monospace'}}>Forgot password?</a>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full h-12 px-4 bg-white border border-[#c7c4d8] rounded-lg text-base text-[#1b1b24] focus:outline-none focus:ring-2 focus:ring-[#3525cd] focus:ring-offset-2 focus:border-[#3525cd] transition-all placeholder:text-[#777587]"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#464555] hover:text-[#1b1b24]">
                  <span className="material-symbols-outlined text-[20px]">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-[#c7c4d8] text-[#3525cd] focus:ring-[#3525cd]"
              />
              <label htmlFor="remember" className="text-xs text-[#464555] cursor-pointer" style={{fontFamily:'JetBrains Mono, monospace'}}>Keep me logged in for 30 days</label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#3525cd] text-white text-base font-semibold rounded-lg hover:bg-[#4f46e5] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                  Authenticating...
                </>
              ) : (
                <>
                  Sign in
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#c7c4d8]"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-xs text-[#464555] uppercase tracking-wider" style={{fontFamily:'JetBrains Mono, monospace'}}>Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-2 h-11 border border-[#c7c4d8] rounded-lg text-sm text-[#1b1b24] hover:bg-[#f0ecf9] transition-colors" style={{fontFamily:'JetBrains Mono, monospace'}}>
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </button>
            <button className="flex items-center justify-center gap-2 h-11 border border-[#c7c4d8] rounded-lg text-sm text-[#1b1b24] hover:bg-[#f0ecf9] transition-colors" style={{fontFamily:'JetBrains Mono, monospace'}}>
              <span className="material-symbols-outlined text-[18px]">passkey</span>
              SSO
            </button>
          </div>

          <p className="mt-10 text-center text-sm text-[#464555]">
            Don't have an account?{' '}
            <a href="#" className="text-[#3525cd] font-semibold hover:underline">Start free trial</a>
          </p>
        </div>
      </section>

      {/* Success toast */}
      {showToast && (
        <div className="fixed bottom-8 right-8 bg-[#1b1b24] text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 z-50 animate-slide-in-right">
          <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-white text-[16px]" style={{fontVariationSettings:"'FILL' 1"}}>check</span>
          </div>
          <div>
            <p className="font-bold text-base">Authenticated</p>
            <p className="text-xs opacity-80">Redirecting to enterprise dashboard...</p>
          </div>
        </div>
      )}
    </main>
  );
}
