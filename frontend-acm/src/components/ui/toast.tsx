import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'success' | 'error' | 'info';

/** REQ-260903C — sticky(수동 닫기 전 유지) + 액션 버튼 옵션. */
export interface ToastOptions {
  sticky?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  sticky?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  show: (message: string, variant?: ToastVariant, opts?: ToastOptions) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string, opts?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback(
    (message: string, variant: ToastVariant = 'info', opts?: ToastOptions) => {
      const id = ++toastIdCounter;
      setToasts((prev) => [...prev, { id, message, variant, ...opts }]);
      if (!opts?.sticky) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
      }
    },
    [],
  );

  const value: ToastContextValue = {
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
    info: (m, opts) => show(m, 'info', opts),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="pointer-events-none fixed top-4 right-4 z-[100] flex flex-col gap-2"
      >
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto min-w-[260px] max-w-[420px] rounded-md border px-4 py-3 text-sm shadow-md transition-opacity',
        visible ? 'opacity-100' : 'opacity-0',
        toast.variant === 'success' && 'border-green-300 bg-green-50 text-green-800',
        toast.variant === 'error' && 'border-red-300 bg-red-50 text-red-800',
        toast.variant === 'info' && 'border-[var(--border-subtle)] bg-surface text-primary',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex-1 whitespace-pre-line">{toast.message}</span>
        <button
          onClick={onDismiss}
          className="text-secondary hover:text-primary"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
      {toast.actionLabel && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() => {
              toast.onAction?.();
              onDismiss();
            }}
            className="rounded-md border border-[var(--border-subtle)] px-2.5 py-1 text-xs font-medium text-accent-700 hover:bg-[var(--gray-50)]"
          >
            {toast.actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
