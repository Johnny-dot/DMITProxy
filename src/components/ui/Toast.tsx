import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/src/utils/cn';
import { motion, AnimatePresence } from 'motion/react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, opts?: { duration?: number }) => void;
}

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3000,
  info: 3500,
  error: 6000,
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timersRef.current.get(id);
    if (handle !== undefined) {
      window.clearTimeout(handle);
      timersRef.current.delete(id);
    }
  }, []);

  const scheduleAutoDismiss = useCallback(
    (id: string, duration: number) => {
      const handle = window.setTimeout(() => removeToast(id), duration);
      timersRef.current.set(id, handle);
    },
    [removeToast],
  );

  const toast = useCallback<ToastContextType['toast']>(
    (message, type = 'info', opts) => {
      const id = Math.random().toString(36).substring(2, 9);
      const duration = opts?.duration ?? DEFAULT_DURATIONS[type];
      setToasts((prev) => [...prev, { id, message, type, duration }]);
      scheduleAutoDismiss(id, duration);
    },
    [scheduleAutoDismiss],
  );

  // Pause/resume the dismiss timer when the user hovers a toast.
  const pauseToast = useCallback((id: string) => {
    const handle = timersRef.current.get(id);
    if (handle === undefined) return;
    window.clearTimeout(handle);
    timersRef.current.delete(id);
  }, []);

  const resumeToast = useCallback(
    (id: string) => {
      if (timersRef.current.has(id)) return;
      const target = toasts.find((t) => t.id === id);
      if (!target) return;
      // Give a slightly shortened duration on resume so a moused-over toast still
      // disappears in a reasonable time after the cursor leaves.
      const remaining = Math.max(1500, Math.floor(target.duration / 2));
      scheduleAutoDismiss(id, remaining);
    },
    [scheduleAutoDismiss, toasts],
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((handle) => window.clearTimeout(handle));
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-[110] flex flex-col gap-3"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              onMouseEnter={() => pauseToast(t.id)}
              onMouseLeave={() => resumeToast(t.id)}
              onFocus={() => pauseToast(t.id)}
              onBlur={() => resumeToast(t.id)}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.18 } }}
              className={cn(
                'pointer-events-auto flex min-w-[300px] items-center gap-3 rounded-[22px] border px-4 py-3 shadow-[var(--shadow-card)]',
                t.type === 'success' &&
                  'border-transparent bg-[var(--success-soft)] text-[var(--success)]',
                t.type === 'error' &&
                  'border-transparent bg-[var(--danger-soft)] text-[var(--danger)]',
                t.type === 'info' &&
                  'border-[color:var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-primary)]',
              )}
            >
              {t.type === 'success' && <CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
              {t.type === 'error' && <AlertCircle className="h-5 w-5" aria-hidden="true" />}
              {t.type === 'info' && <Info className="h-5 w-5" aria-hidden="true" />}
              <span className="flex-1 text-sm font-medium">{t.message}</span>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss notification"
                className="rounded-full p-1 transition-colors hover:bg-[var(--surface-panel)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
              >
                <X className="h-4 w-4 opacity-50 hover:opacity-100" aria-hidden="true" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
