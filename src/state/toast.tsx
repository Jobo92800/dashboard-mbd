import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type Toast = { id: number; text: string; tone: 'ok' | 'erreur' };
const Ctx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((l) => [...l, { id, text, tone }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), tone === 'erreur' ? 5000 : 2600);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-[100] flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-2 lg:bottom-5" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            className={`rounded-mab-pilule px-5 py-3 text-center text-sm font-medium text-white shadow-mab-flottante ${
              t.tone === 'erreur' ? 'bg-mab-erreur' : 'bg-mab-aqua-encre'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
