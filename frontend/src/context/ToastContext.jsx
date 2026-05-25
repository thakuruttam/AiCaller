import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration) setTimeout(() => removeToast(id), duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none w-[340px]">
        {toasts.map(toast => (
          <ToastItem key={toast.id} {...toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const CONFIG = {
  success: {
    icon: CheckCircle2,
    wrapper: 'bg-zinc-900 border-zinc-700/80',
    icon_cls: 'text-emerald-400',
    text: 'text-zinc-100',
    bar: 'bg-emerald-500',
  },
  error: {
    icon: AlertCircle,
    wrapper: 'bg-zinc-900 border-zinc-700/80',
    icon_cls: 'text-red-400',
    text: 'text-zinc-100',
    bar: 'bg-red-500',
  },
  warning: {
    icon: AlertTriangle,
    wrapper: 'bg-zinc-900 border-zinc-700/80',
    icon_cls: 'text-amber-400',
    text: 'text-zinc-100',
    bar: 'bg-amber-500',
  },
  info: {
    icon: Info,
    wrapper: 'bg-zinc-900 border-zinc-700/80',
    icon_cls: 'text-blue-400',
    text: 'text-zinc-100',
    bar: 'bg-blue-500',
  },
};

const ToastItem = ({ message, type, onRemove }) => {
  const c = CONFIG[type] || CONFIG.info;
  const Icon = c.icon;

  return (
    <div className={`pointer-events-auto relative flex items-start gap-3 rounded-xl border px-4 py-3.5 shadow-2xl shadow-black/20 overflow-hidden animate-slide-in-right ${c.wrapper}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${c.bar}`} />
      <Icon size={16} className={`shrink-0 mt-0.5 ${c.icon_cls}`} />
      <p className={`flex-1 text-sm leading-relaxed font-medium ${c.text}`}>{message}</p>
      <button
        onClick={onRemove}
        className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors mt-0.5 ml-1"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
