import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import type { StdStatus } from '../types';

const STATUS_CLASS: Record<StdStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  INACTIVE: 'bg-amber-50 text-amber-700',
  WITHDRAWN: 'bg-red-50 text-red-700',
};

export function StdStatusBadge({ status }: { status: StdStatus }) {
  const { t } = useTranslation('std');
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
