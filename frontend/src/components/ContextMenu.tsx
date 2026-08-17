import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export interface CtxItem {
  label?: string;
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  sep?: boolean;
  header?: string;
  onClick?: () => void;
}

interface CtxState {
  x: number;
  y: number;
  items: CtxItem[];
}

const CtxContext = createContext<(e: { clientX: number; clientY: number; preventDefault(): void; stopPropagation(): void }, items: CtxItem[]) => void>(() => {});

export function useCtxMenu() {
  return useContext(CtxContext);
}

export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CtxState | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const open = useCallback(
    (e: { clientX: number; clientY: number; preventDefault(): void; stopPropagation(): void }, items: CtxItem[]) => {
      e.preventDefault();
      e.stopPropagation();
      setState({ x: e.clientX, y: e.clientY, items });
    },
    []
  );

  useEffect(() => {
    if (!state || !ref.current) return;
    // Clamp the menu inside the window.
    const el = ref.current;
    const r = el.getBoundingClientRect();
    let { x, y } = state;
    if (x + r.width > window.innerWidth - 8) x = window.innerWidth - r.width - 8;
    if (y + r.height > window.innerHeight - 8) y = window.innerHeight - r.height - 8;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }, [state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setState(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <CtxContext.Provider value={open}>
      {children}
      {state && (
        <>
          <div
            className="ctx-backdrop"
            onMouseDown={() => setState(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setState(null);
            }}
          />
          <div className="ctx-menu" ref={ref} style={{ left: state.x, top: state.y }}>
            {state.items.map((it, i) => {
              if (it.sep) return <div key={i} className="ctx-sep" />;
              if (it.header) return <div key={i} className="ctx-label">{it.header}</div>;
              return (
                <button
                  key={i}
                  className={'ctx-item' + (it.danger ? ' danger' : '')}
                  disabled={it.disabled}
                  onClick={() => {
                    setState(null);
                    it.onClick?.();
                  }}
                >
                  <span>{it.label}</span>
                  {it.hint && <span className="hint">{it.hint}</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </CtxContext.Provider>
  );
}
