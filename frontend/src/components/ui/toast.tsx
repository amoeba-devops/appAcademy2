'use client';

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Amoeba Web Style Guide v2.0 §12.1 — Toast Notifications
export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

const VARIANT_MAP: Record<
  ToastVariant,
  { className: string; Icon: typeof CheckCircle; iconClass: string; role: 'status' | 'alert' }
> = {
  success: {
    className: 'amb-toast amb-toast-success',
    Icon: CheckCircle,
    iconClass: 'text-amb-success',
    role: 'status',
  },
  error: {
    className: 'amb-toast amb-toast-error',
    Icon: XCircle,
    iconClass: 'text-amb-error',
    role: 'alert',
  },
  warning: {
    className: 'amb-toast amb-toast-warning',
    Icon: AlertTriangle,
    iconClass: 'text-amb-warning',
    role: 'alert',
  },
  info: {
    className: 'amb-toast amb-toast-info',
    Icon: Info,
    iconClass: 'text-amb-info',
    role: 'status',
  },
};

export interface ToastProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: ToastVariant;
  title?: React.ReactNode;
  message: React.ReactNode;
  onDismiss?: () => void;
}

export function Toast({
  variant = 'info',
  title,
  message,
  onDismiss,
  className,
  ...rest
}: ToastProps) {
  const { t } = useTranslation('common');
  const { className: base, Icon, iconClass, role } = VARIANT_MAP[variant];
  return (
    <div role={role} aria-live="polite" className={cn(base, className)} {...rest}>
      <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', iconClass)} aria-hidden="true" />
      <div className="flex-1 text-sm">
        {title ? <div className="font-medium">{title}</div> : null}
        <div className={cn(title && 'mt-0.5 text-[13px] opacity-90')}>{message}</div>
      </div>
      {onDismiss ? (
        <button
          type="button"
          aria-label={t('actions.dismiss-toast')}
          onClick={onDismiss}
          className="shrink-0 rounded p-1 opacity-60 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amb-primary-500"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

// Amoeba §12.1 — max 3 stacked, top-right
export function ToastContainer({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation('common');
  return (
    <div
      aria-label={t('actions.toast-region')}
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-[min(24rem,calc(100vw-2rem))]"
    >
      {children}
    </div>
  );
}
