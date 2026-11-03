import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth.store';
import { PortalClassInfo } from '../components/portal-class-info';

/**
 * REQ-261103C — 학생·학부모 포털 "수업링크" 메뉴: 강사별 링크 목록(과목·교재 포함).
 * 강사가 학생별로 등록한 링크(관리자 학생관리 또는 강사 포털 수강생 상세).
 */
export function PortalLinksPage() {
  const { t } = useTranslation('common');
  const kind = useAuthStore((s) => s.portal.user?.kind);
  if (kind !== 'STUDENT' && kind !== 'PARENT') {
    return (
      <p className="rounded-md border border-[var(--border-subtle)] p-6 text-center text-sm text-secondary">
        {t('portalApp.links.learnerOnly')}
      </p>
    );
  }
  return (
    <PortalClassInfo
      byChild={kind === 'PARENT'}
      title={t('portalApp.nav.links')}
      className=""
    />
  );
}
