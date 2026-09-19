import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle } from '@phosphor-icons/react';

const ToastContext = createContext(() => {});

// One toast at a time, 5 seconds, and only to confirm something Sara just did.
// Background events use the banner and the status pill, never a toast.
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((message) => setToast({ message, id: Date.now() }), []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-gutter bottom-[calc(var(--primitive-size-tabbar)+1rem)] md:bottom-8"
      >
        {toast && (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-3 rounded-md border-thick border-border-block bg-block-feature-bg px-4 py-3 text-sm font-semibold text-block-feature-fg motion-safe:animate-pop-in"
          >
            <CheckCircle aria-hidden size={20} weight="fill" className="flex-none text-success-solid" />
            {toast.message}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
