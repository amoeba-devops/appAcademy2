import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { UnderlineTabs } from '@/components/ui/tabs';

const TABS = ['activity', 'access', 'control'] as const;
type Tab = (typeof TABS)[number];

/** REQ-261021B — 감사: 활동 로그 · 접속 로그 · 접속 통제 (사이드바는 하위 메뉴가 없어 탭으로). */
export function AuditLayout() {
  const { t } = useTranslation('aud');
  const { t: tc } = useTranslation('common');
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current = (TABS.find((k) => pathname.startsWith(`/admin/audit/${k}`)) ?? 'access') as Tab;
  return (
    <div className="w-full min-w-0">
      <PageHeader
        icon={ShieldCheck}
        title={tc('nav.audit')}
        description={t('desc')}
        tabs={
          <UnderlineTabs
            label={tc('nav.audit')}
            items={TABS.map((k) => ({ key: k, label: t(`tabs.${k}`) }))}
            value={current}
            onChange={(k) => navigate(`/admin/audit/${k}`)}
          />
        }
      />
      <Outlet />
    </div>
  );
}
