import React from 'react';
import { Link } from 'react-router-dom';

// Small shared pieces for the marketing page. Deliberately separate from the
// app's `components/ui` primitives: the product UI is dense and utilitarian,
// the marketing page is typographic and spacious, and forcing one set of
// components to serve both compromises both.

export function Container({ className = '', children }) {
  return <div className={`mx-auto w-full max-w-[1200px] px-5 sm:px-8 ${className}`}>{children}</div>;
}

export function Eyebrow({ children, className = '' }) {
  return (
    <p className={`inline-flex items-center gap-2 text-[13px] font-semibold tracking-tight text-brand-500 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-brand-500" aria-hidden="true" />
      {children}
    </p>
  );
}

export function SectionHeading({ eyebrow, title, body, align = 'left', className = '' }) {
  const centred = align === 'center';
  return (
    <div className={`${centred ? 'mx-auto text-center' : ''} max-w-2xl ${className}`}>
      {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
      <h2 className="text-[clamp(1.75rem,3.4vw,2.6rem)] font-semibold leading-[1.12] tracking-[-0.025em] text-ink-100">
        {title}
      </h2>
      {body && <p className="mt-4 text-[17px] leading-relaxed text-ink-600">{body}</p>}
    </div>
  );
}

const CTA_BASE =
  'inline-flex items-center justify-center gap-2 rounded-control text-[15px] font-semibold ' +
  'transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-2';

export function PrimaryCta({ to = '/login', children, className = '', ...props }) {
  return (
    <Link to={to} className={`${CTA_BASE} h-12 px-6 bg-brand-500 text-white hover:bg-brand-600 ${className}`} {...props}>
      {children}
      <span className="material-symbols-outlined [--icon-size:18px]">arrow_forward</span>
    </Link>
  );
}

export function SecondaryCta({ as: asProp = 'button', children, className = '', ...props }) {
  const As = asProp;
  return (
    <As
      className={`${CTA_BASE} h-12 px-5 bg-paper-100 text-ink-100 border border-paper-600 hover:bg-paper-300 hover:border-paper-700 ${className}`}
      {...props}
    >
      {children}
    </As>
  );
}

// A screenshot presented as the real application — browser chrome makes the
// difference between "a picture" and "the product" at a glance.
export function AppFrame({ src, alt, className = '', priority = false, url = 'app.aicaller.store' }) {
  return (
    <div
      className={`overflow-hidden rounded-card border border-ink-100/10 bg-paper-100
                  shadow-[0_30px_70px_-28px_rgba(16,16,16,0.45)] ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-ink-100/[0.07] bg-paper-300 px-3 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="mx-2 flex h-5 flex-1 items-center justify-center rounded-full border border-ink-100/[0.06] bg-paper-100">
          <span className="text-[10px] tracking-tight text-ink-800">{url}</span>
        </span>
      </div>
      <img
        src={src}
        alt={alt}
        width={1483}
        height={812}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className="block h-auto w-full"
      />
    </div>
  );
}

// FAQ list as native <details>/<summary>: every answer is in the HTML (so
// crawlers and answer engines read it, and FAQ structured data matches
// visible text), it works without JavaScript, and the disclosure semantics
// come from the browser rather than hand-rolled ARIA.
export function FaqList({ items, className = '' }) {
  return (
    <div className={`mx-auto max-w-3xl divide-y divide-paper-500 border-y border-paper-500 ${className}`}>
      {items.map((f) => (
        <details key={f.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 [&::-webkit-details-marker]:hidden">
            <h3 className="text-[15px] font-semibold text-ink-100">{f.q}</h3>
            <span
              className="material-symbols-outlined shrink-0 text-ink-700 transition-transform [--icon-size:20px] group-open:rotate-180"
              aria-hidden="true"
            >
              expand_more
            </span>
          </summary>
          <p className="pb-5 pr-10 text-[15px] leading-relaxed text-ink-600">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

// Visible trail matching the page's BreadcrumbList structured data
// (seo/pages.js) — same items, same order.
export function Breadcrumbs({ items, className = '' }) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-700">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={item.path} className="flex items-center gap-1.5">
              {last ? (
                <span aria-current="page" className="font-medium text-ink-100">{item.name}</span>
              ) : (
                <Link to={item.path} className="transition-colors hover:text-ink-100">{item.name}</Link>
              )}
              {!last && <span aria-hidden="true" className="text-ink-800">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
