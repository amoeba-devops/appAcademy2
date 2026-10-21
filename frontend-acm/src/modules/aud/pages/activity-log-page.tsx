import { useTranslation } from 'react-i18next';
import { Notice } from '@/components/ui/empty-state';

/** REQ-261021B — 활동 로그는 P2 에서 제공. */
export function ActivityLogPage() {
  const { t } = useTranslation('aud');
  return <Notice tone="info">{t('activity.pending')}</Notice>;
}
