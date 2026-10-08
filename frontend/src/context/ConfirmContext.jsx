import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import Modal from '../components/Modal';
import { Button } from '../components/ui';

const ConfirmContext = createContext(null);

// App-wide replacement for window.confirm(): a themed dialog that resolves a
// promise, so callers keep the same `if (!(await confirm(...))) return;` flow.
// The browser's native dialog can't be styled, blocks the whole tab, and on
// some browsers offers "prevent this page from creating dialogs".
//
//   const confirm = useConfirm();
//   if (!(await confirm({ title: 'Remove Asha?', body: '…', confirmLabel: 'Remove', tone: 'danger' }))) return;
export const ConfirmProvider = ({ children }) => {
  const [request, setRequest] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setRequest(typeof options === 'string' ? { title: options } : options);
  }), []);

  const settle = useCallback((answer) => {
    resolver.current?.(answer);
    resolver.current = null;
    setRequest(null);
  }, []);

  const cancel = useCallback(() => settle(false), [settle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        isOpen={!!request}
        onClose={cancel}
        size="sm"
        tone={request?.tone ?? 'danger'}
        title={request?.title}
        description={request?.body}
        footer={<>
          <Button variant="secondary" onClick={cancel}>{request?.cancelLabel ?? 'Cancel'}</Button>
          <Button
            variant={(request?.tone ?? 'danger') === 'danger' ? 'danger' : 'primary'}
            onClick={() => settle(true)}
          >
            {request?.confirmLabel ?? 'Confirm'}
          </Button>
        </>}
      />
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx;
};
