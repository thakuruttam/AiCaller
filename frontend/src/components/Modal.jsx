import React, { useEffect } from 'react';
import { X } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children, footer, className }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Content */}
      <div className={`relative w-full bg-card border shadow-2xl rounded-xl transform-gpu animate-in zoom-in-95 duration-200 ${className || 'max-w-md'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6">
          {children}
        </div>
        
        {/* Footer */}
        {footer && (
          <div className="flex justify-end gap-3 p-6 border-t bg-muted/30">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
