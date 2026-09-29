import React from 'react';
import { Link } from 'react-router-dom';
import { MiniLogo } from './Nav';

export function Footer() {
  return (
    <footer className="bg-[#101010] border-t border-white/5 py-10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
        <a href="#top" className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#266df0] rounded-lg">
          <MiniLogo className="w-7 h-7" />
          <span className="font-display font-bold text-white text-[13.5px] tracking-tight">AI Caller Pro</span>
        </a>

        <nav aria-label="Footer">
          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <li><a href="#features" className="text-xs font-medium text-ink-800 hover:text-white transition-colors">Features</a></li>
            <li><a href="#how-it-works" className="text-xs font-medium text-ink-800 hover:text-white transition-colors">How it works</a></li>
            <li><a href="#faq" className="text-xs font-medium text-ink-800 hover:text-white transition-colors">FAQ</a></li>
            <li><Link to="/support" className="text-xs font-medium text-ink-800 hover:text-white transition-colors">Support</Link></li>
            <li><Link to="/login" className="text-xs font-medium text-ink-800 hover:text-white transition-colors">Sign in</Link></li>
          </ul>
        </nav>

        <p className="text-xs font-medium text-ink-700">© {new Date().getFullYear()} AI Caller Pro. All rights reserved.</p>
      </div>
    </footer>
  );
}
