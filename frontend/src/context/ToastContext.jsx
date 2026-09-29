import React, { createContext, useContext, useState, useCallback } from 'react';
import { Button, IconButton } from '../components/ui';
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
    wrapper: 'bg-ink-100 border-ink-400/80',
    icon_cls: 'text-positive',
    text: 'text-paper-200',
    bar: 'bg-positive',
  },
  error: {
    icon: AlertCircle,
    wrapper: 'bg-ink-100 border-ink-400/80',
    icon_cls: 'text-negative',
    text: 'text-paper-200',
    bar: 'bg-negative/100',
  },
  warning: {
    icon: AlertTriangle,
    wrapper: 'bg-ink-100 border-ink-400/80',
    icon_cls: 'text-caution',
    text: 'text-paper-200',
    bar: 'bg-caution/100',
  },
  info: {
    icon: Info,
    wrapper: 'bg-ink-100 border-ink-400/80',
    icon_cls: 'text-brand-300',
    text: 'text-paper-200',
    bar: 'bg-brand-500',
  },
};

const ToastItem = ({ message, type, onRemove }) => {
  const c = CONFIG[type] || CONFIG.info;
  const Icon = c.icon;

  return (
    <div className={`pointer-events-auto relative flex items-start gap-3 rounded-card border px-4 py-3.5 shadow-overlay shadow-black/20 overflow-hidden animate-slide-in-right ${c.wrapper}`}>
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${c.bar}`} />
      <Icon size={16} className={`shrink-0 mt-0.5 ${c.icon_cls}`} />
      <p className={`flex-1 text-sm leading-relaxed font-medium ${c.text}`}>{message}</p>
      <Button variant="ghost" size="md" onClick={onRemove}>
        <X size={14} />
      </Button>
    </div>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};
