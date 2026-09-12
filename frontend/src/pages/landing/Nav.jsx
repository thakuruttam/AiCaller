import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AudioLines, Menu, X, Compass } from 'lucide-react';
import { NAV_LINKS } from './data';

export function MiniLogo({ className = 'w-9 h-9' }) {
  return (
    <div className={`${className} rounded-xl bg-[#0d9488] flex items-center justify-center shrink-0`} style={{ boxShadow: '0 4px 14px rgba(13,148,136,0.35)' }}>
      <AudioLines className="w-[55%] h-[55%] text-white" strokeWidth={2.5} />
    </div>
  );
}

export function Nav({ onTakeTour }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-[#0a0f1a]/95 backdrop-blur border-b border-white/5">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between" aria-label="Primary">
        <a href="#top" className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488] rounded-lg">
          <MiniLogo className="w-8 h-8" />
          <span className="font-display font-bold text-white text-[15px] tracking-tight">AI Caller Pro</span>
        </a>

        <ul className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(l => (
            <li key={l.href}>
              <a href={l.href} className="text-sm font-medium text-slate-300 hover:text-white transition-colors">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={onTakeTour}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-200 hover:text-white transition-colors px-3 py-2 rounded-lg cursor-pointer"
          >
            <Compass size={16} />
            Take a tour
          </button>
          <Link to="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors px-3 py-2 rounded-lg cursor-pointer">
            Sign in
          </Link>
          <Link
            to="/login"
            className="text-sm font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] transition-colors px-4 py-2.5 rounded-lg cursor-pointer"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="md:hidden w-10 h-10 flex items-center justify-center text-white rounded-lg hover:bg-white/5 cursor-pointer"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {open && (
        <div id="mobile-menu" className="md:hidden border-t border-white/5 px-6 py-4 flex flex-col gap-1">
          {NAV_LINKS.map(l => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-slate-300 hover:text-white py-2.5"
            >
              {l.label}
            </a>
          ))}
          <button
            type="button"
            onClick={() => { setOpen(false); onTakeTour?.(); }}
            className="text-left text-sm font-medium text-slate-300 hover:text-white py-2.5 flex items-center gap-1.5"
          >
            <Compass size={16} />
            Take a tour
          </button>
          <div className="flex flex-col gap-2 mt-2">
            <Link to="/login" className="text-center text-sm font-medium text-slate-300 hover:text-white py-2.5 rounded-lg border border-white/10 cursor-pointer">
              Sign in
            </Link>
            <Link to="/login" className="text-center text-sm font-semibold text-white bg-[#0d9488] hover:bg-[#0f766e] py-2.5 rounded-lg cursor-pointer">
              Get started
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
