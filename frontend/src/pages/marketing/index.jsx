import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, PrimaryCta } from './parts';
import { NAV_LINKS } from './content';
import { Hero, ProductTour, Capabilities, HowItWorks, Trust, Faq, FinalCta } from './Sections';

function Wordmark({ className = '' }) {
  return (
    <Link to="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="flex h-8 w-8 items-center justify-center rounded-chip bg-brand-500">
        <span className="material-symbols-outlined text-white [--icon-size:18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          graphic_eq
        </span>
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink-100">AI Caller Pro</span>
    </Link>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // The bar only grows a hairline and a blur once the page has moved — at rest
  // it should sit flat on the hero rather than framing it.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-200 ${
        scrolled ? 'border-b border-paper-500 bg-paper-100/85 backdrop-blur-md' : 'border-b border-transparent'
      }`}
    >
      <Container className="flex h-16 items-center justify-between gap-6">
        <Wordmark />

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map(l => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-sm text-sm font-medium text-ink-600 outline-none transition-colors hover:text-ink-100 focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="rounded-sm text-sm font-medium text-ink-600 outline-none transition-colors hover:text-ink-100 focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            Sign in
          </Link>
          <PrimaryCta className="!h-10 !px-4 !text-sm">Get started</PrimaryCta>
        </div>

        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          className="-mr-1 cursor-pointer rounded-control p-2 text-ink-600 outline-none transition-colors hover:bg-paper-300 focus-visible:ring-2 focus-visible:ring-brand-500/40 md:hidden"
        >
          <span className="material-symbols-outlined [--icon-size:22px]">{menuOpen ? 'close' : 'menu'}</span>
        </button>
      </Container>

      {menuOpen && (
        <div className="animate-fade-in border-t border-paper-500 bg-paper-100 md:hidden">
          <Container className="flex flex-col gap-1 py-4">
            {NAV_LINKS.map(l => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-control px-2 py-3 text-[15px] font-medium text-ink-600 transition-colors hover:bg-paper-300 hover:text-ink-100"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-paper-500 pt-4">
              <Link to="/login" className="rounded-control px-2 py-3 text-[15px] font-medium text-ink-600 hover:bg-paper-300">
                Sign in
              </Link>
              <PrimaryCta className="w-full">Get started</PrimaryCta>
            </div>
          </Container>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-paper-500 bg-paper-200 py-12">
      <Container className="flex flex-col items-center justify-between gap-6 sm:flex-row">
        <Wordmark />
        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={l.href} className="text-sm text-ink-600 transition-colors hover:text-ink-100">
              {l.label}
            </a>
          ))}
          <Link to="/login" className="text-sm text-ink-600 transition-colors hover:text-ink-100">Sign in</Link>
        </nav>
        <p className="text-sm text-ink-700">© {new Date().getFullYear()} AI Caller Pro</p>
      </Container>
    </footer>
  );
}

export default function Marketing() {
  useEffect(() => {
    document.title = 'AI Caller Pro — AI Voice Calling & Outbound Campaign Platform';
  }, []);

  return (
    <div className="min-h-screen bg-paper-100 antialiased">
      <Nav />
      <main>
        <Hero />
        <ProductTour />
        <Capabilities />
        <HowItWorks />
        <Trust />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
