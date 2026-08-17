import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export interface ToastMsg {
  id: number;
  kind: 'info' | 'success' | 'error';
  text: string;
  detail?: string;
}

const ToastContext = createContext<(kind: ToastMsg['kind'], text: string, detail?: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastMsg['kind'], text: string, detail?: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, text, detail }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5200);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + t.kind}>
            <div>{t.text}</div>
            {t.detail && <div className="tp">{t.detail}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
