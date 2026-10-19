import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Notice } from '@/components/ui/empty-state';

/** REQ-261019B — 로그인 유지 시간이 지나 돌아온 경우(`?expired=1`) 로그인 화면 안내. */
export function SessionExpiredNotice({ className = 'mb-4' }: { className?: string }) {
  const { t } = useTranslation('common');
  const [params] = useSearchParams();
  if (params.get('expired') !== '1') return null;
  return (
    <div className={className}>
      <Notice tone="info">{t('session.expired')}</Notice>
    </div>
  );
}
