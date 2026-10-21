import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { useConfigAccess } from '@/modules/cfg/hooks/use-config-access';
import { buttonVariants } from '@/components/ui/button';

/** PLN-261022 — "감사 이력": opens the activity log filtered to one target. Audit viewers only. */
export function AuditHistoryLink({ targetType, targetId, label }: { targetType: string; targetId: string; label?: string }) {
  const { t } = useTranslation('aud');
  const access = useConfigAccess();
  if (!access.auditAllowed) return null;
  const q = new URLSearchParams({ targetType, targetId, ...(label ? { label } : {}) });
  return (
    <Link to={`/admin/audit/activity?${q.toString()}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
      <ShieldCheck size={14} className="mr-1" />
      {t('activity.historyLink')}
    </Link>
  );
}
