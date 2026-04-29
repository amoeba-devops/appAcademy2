import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import type { ClsStatus } from '../types';

const STATUS_CLASS: Record<ClsStatus, string> = {
  PROPOSED: 'bg-[var(--gray-200)] text-secondary',
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  PAUSED: 'bg-amber-50 text-amber-700',
  COMPLETED: 'bg-slate-100 text-slate-700',
  CANCELLED: 'bg-red-50 text-red-700',
};

export function ClsStatusBadge({ status }: { status: ClsStatus }) {
  const { t } = useTranslation('cls');
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded px-2 py-1 text-xs font-medium',
        STATUS_CLASS[status],
      )}
    >
      {t(`status.${status}`)}
    </span>
  );
}
