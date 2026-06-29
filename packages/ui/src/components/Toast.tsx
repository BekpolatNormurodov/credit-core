import React, { createContext, useCallback, useContext, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Warning, Info, X } from '../lib/icons';
import { cn } from '../lib/cn';

type ToastTone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  message?: string;
}

interface ToastApi {
  push: (t: Omit<Toast, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

const toneMap: Record<ToastTone, { icon: React.ComponentType<{ className?: string }>; ring: string; chip: string }> = {
  success: { icon: Check, ring: 'border-l-success-500', chip: 'bg-success-50 text-success-600 dark:bg-success-500/12' },
  error: { icon: Warning, ring: 'border-l-error-500', chip: 'bg-error-50 text-error-600 dark:bg-error-500/12' },
  info: { icon: Info, ring: 'border-l-brand-500', chip: 'bg-brand-50 text-brand-700 dark:bg-brand-500/12' },
};

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);

  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++counter;
    setToasts((ts) => [...ts, { ...t, id }]);
    setTimeout(() => remove(id), 4200);
  }, [remove]);

  const api: ToastApi = {
    push,
    success: (title, message) => push({ tone: 'success', title, message }),
    error: (title, message) => push({ tone: 'error', title, message }),
    info: (title, message) => push({ tone: 'info', title, message }),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-full max-w-sm flex-col gap-2.5 px-4 sm:px-0">
          <AnimatePresence>
            {toasts.map((t) => {
              const cfg = toneMap[t.tone];
              return (
                <motion.div
                  key={t.id}
                  layout
                  role={t.tone === 'error' ? 'alert' : 'status'}
                  aria-live={t.tone === 'error' ? 'assertive' : 'polite'}
                  aria-atomic
                  initial={{ opacity: 0, x: 40, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                  className={cn(
                    'pointer-events-auto flex items-start gap-3 rounded-xl border border-l-4 border-gray-200 bg-white p-3.5 shadow-theme-md',
                    'dark:border-gray-700 dark:bg-gray-800 dark:ring-1 dark:ring-white/10',
                    cfg.ring,
                  )}
                >
                  <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', cfg.chip)}>
                    <cfg.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white">{t.title}</p>
                    {t.message && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{t.message}</p>}
                  </div>
                  <button onClick={() => remove(t.id)} aria-label="Yopish" className="-mr-1 shrink-0 cursor-pointer rounded-md p-0.5 text-gray-400 transition hover:text-gray-700 dark:hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
