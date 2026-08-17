import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const DOC_LIST = [
  { slug: 'readme', title: 'README', file: 'README.md', icon: 'description' },
  { slug: 'architecture', title: 'Architecture Review', file: 'ARCHITECTURE_REVIEW.md', icon: 'account_tree' },
  { slug: 'claude', title: 'Claude Instructions', file: 'CLAUDE.md', icon: 'smart_toy' },
];

const markdownComponents = {
  h1: ({ children }) => <h1 className="text-2xl font-bold text-[#0f172a] dark:text-slate-100 mt-8 mb-4 first:mt-0 pb-2 border-b border-[#e2e8f0] dark:border-slate-700">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-bold text-[#0f172a] dark:text-slate-100 mt-8 mb-3 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold text-[#0f172a] dark:text-slate-100 mt-6 mb-2">{children}</h3>,
  p: ({ children }) => <p className="text-sm text-[#334155] dark:text-slate-300 leading-relaxed mb-4">{children}</p>,
  a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#0d9488] dark:text-teal-400 hover:underline font-medium">{children}</a>,
  ul: ({ children }) => <ul className="list-disc list-outside pl-5 text-sm text-[#334155] dark:text-slate-300 mb-4 space-y-1.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-5 text-sm text-[#334155] dark:text-slate-300 mb-4 space-y-1.5">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-[#0f172a] dark:text-slate-100">{children}</strong>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-[#0d9488] pl-4 my-4 text-sm text-[#64748b] dark:text-slate-400 italic">{children}</blockquote>,
  hr: () => <hr className="my-8 border-[#e2e8f0] dark:border-slate-700" />,
  table: ({ children }) => <div className="overflow-x-auto mb-4 rounded-lg border border-[#e2e8f0] dark:border-slate-700"><table className="w-full text-sm border-collapse">{children}</table></div>,
  thead: ({ children }) => <thead className="bg-[#f8fafc] dark:bg-slate-800">{children}</thead>,
  th: ({ children }) => <th className="text-left px-3 py-2 font-semibold text-[#0f172a] dark:text-slate-100 border-b border-[#e2e8f0] dark:border-slate-700">{children}</th>,
  td: ({ children }) => <td className="px-3 py-2 text-[#334155] dark:text-slate-300 border-b border-[#f1f5f9] dark:border-slate-800">{children}</td>,
  code: ({ inline, children }) =>
    inline
      ? <code className="px-1.5 py-0.5 rounded bg-[#f0fdfa] dark:bg-slate-800 text-[#0f766e] dark:text-teal-400 text-[13px] font-mono">{children}</code>
      : <code className="text-[13px] font-mono text-zinc-200">{children}</code>,
  pre: ({ children }) => <pre className="mb-4 p-4 rounded-lg bg-[#0a0f1a] overflow-x-auto">{children}</pre>,
};

export default function Docs() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const active = DOC_LIST.find(d => d.slug === slug) || DOC_LIST[0];

  // Keyed by file so a slug change is "loading" by default (derived at render time)
  // until the matching fetch resolves — avoids a synchronous setState at effect start.
  const [doc, setDoc] = useState({ file: null, status: 'loading', content: '' });

  useEffect(() => {
    if (!slug) {
      navigate(`/docs/${DOC_LIST[0].slug}`, { replace: true });
      return;
    }
    let cancelled = false;
    fetch(`/docs/${active.file}`)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.text();
      })
      .then(text => { if (!cancelled) setDoc({ file: active.file, status: 'ready', content: text }); })
      .catch(() => { if (!cancelled) setDoc({ file: active.file, status: 'error', content: '' }); });
    return () => { cancelled = true; };
  }, [slug, active.file, navigate]);

  const status = doc.file === active.file ? doc.status : 'loading';
  const content = doc.file === active.file ? doc.content : '';

  return (
    <div className="flex h-full">
      {/* Doc picker */}
      <aside className="w-56 shrink-0 border-r border-[#e2e8f0] dark:border-slate-700 px-3 py-6">
        <p className="px-3 pb-3 text-[10px] font-semibold text-[#94a3b8] dark:text-slate-500 uppercase tracking-widest" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
          Documentation
        </p>
        <nav className="flex flex-col gap-0.5">
          {DOC_LIST.map(doc => (
            <button
              key={doc.slug}
              onClick={() => navigate(`/docs/${doc.slug}`)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-left transition-colors cursor-pointer ${
                doc.slug === active.slug
                  ? 'bg-[#f0fdfa] dark:bg-slate-800 text-[#0d9488] dark:text-teal-400'
                  : 'text-[#64748b] dark:text-slate-400 hover:bg-[#f8fafc] dark:hover:bg-slate-800/50 hover:text-[#0f172a] dark:hover:text-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{doc.icon}</span>
              {doc.title}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-10 py-8 max-w-4xl">
        {status === 'loading' && (
          <div className="flex items-center gap-2 text-sm text-[#64748b] dark:text-slate-400">
            <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            Loading…
          </div>
        )}
        {status === 'error' && (
          <div className="text-sm text-red-600 dark:text-red-400">
            Couldn't load this document. Try refreshing the page.
          </div>
        )}
        {status === 'ready' && (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
